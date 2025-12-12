/**
 * Video Analysis API
 *
 * POST /api/work/analyze
 * - 워크플로우 생성 및 AI 분석 시작
 */
import type { Route } from "./+types/analyze";

import { and, eq, isNull, sql } from "drizzle-orm";

import db from "~/core/db/drizzle-client.server";
import makeServerClient from "~/core/lib/supa-client.server";
import { workWorkflows } from "~/features/work/business-logic/schema";
import { requireVideoAnalysisRateLimit } from "~/features/work/rate-limiting/rate-limit.guard";
import { checkWorkflowQuota } from "~/features/work/services/quota.server";
import { analyzeVideoInBackground } from "~/features/work/services/video-analyzer.server";
import { workWorkflowMembers } from "~/features/work/team-management/schema";
import { workTeamMembers } from "~/features/work/team-management/team-schema";
import { workVideos } from "~/features/work/upload/schema";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const [supabase, headers] = makeServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  // 비디오 분석 요청 제한 확인 (인증 직후 실행)
  console.log("Starting rate limit check for user:", user.id);
  try {
    await requireVideoAnalysisRateLimit(supabase);
    console.log("Rate limit check passed");
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // React Router의 data() 함수가 반환한 에러는 자동으로 응답으로 처리됨
    throw error;
  }

  // 워크플로우 생성 한도 확인
  try {
    await checkWorkflowQuota(user.id);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 403, headers });
  }

  try {
    const requestBody = await request.json();
    console.log("Analyze request body:", requestBody);
    const { video_id } = requestBody;

    // 비디오 조회
    const video = await db.query.workVideos.findFirst({
      where: eq(workVideos.video_id, video_id),
    });

    if (!video) {
      return Response.json(
        { error: "Video not found" },
        { status: 404, headers },
      );
    }

    if (video.owner_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers });
    }

    // 사용자의 활성 팀 찾기 (우선순위: owner > admin > member)
    const [activeTeam] = await db
      .select({
        team_id: workTeamMembers.team_id,
        role: workTeamMembers.role,
      })
      .from(workTeamMembers)
      .where(
        and(
          eq(workTeamMembers.user_id, user.id),
          eq(workTeamMembers.status, "active" as any),
        ),
      )
      .orderBy(
        // 우선순위: owner > admin > member
        sql`CASE WHEN ${workTeamMembers.role} = 'owner' THEN 1 
              WHEN ${workTeamMembers.role} = 'admin' THEN 2 
              ELSE 3 END`,
      )
      .limit(1);

    // 워크플로우 생성 (팀이 있으면 팀에 소속)
    const [workflow] = await db
      .insert(workWorkflows)
      .values({
        owner_id: user.id,
        title: video.title || "새 업무 프로세스",
        description: `${video.original_filename}에서 자동 생성된 업무 프로세스`,
        source_video_id: video.video_id,
        duration_seconds: video.duration_seconds,
        thumbnail_url: video.thumbnail_url,
        status: "analyzing",
        requested_at: new Date(),
        team_id: activeTeam?.team_id || null,
      })
      .returning();

    // 레거시 호환성: 생성자를 admin 멤버로 자동 추가 (팀 기반 시스템에서는 필요 없음)
    if (!activeTeam) {
      await db.insert(workWorkflowMembers).values({
        workflow_id: workflow.workflow_id,
        user_id: user.id,
        role: "admin",
        status: "active",
        joined_at: new Date(),
      });
    }

    // 비디오 상태 업데이트
    await db
      .update(workVideos)
      .set({ status: "uploading" })
      .where(eq(workVideos.video_id, video_id));

    // 백그라운드 AI 분석 시작
    analyzeVideoInBackground(video.video_id, workflow.workflow_id);

    return Response.json(
      {
        success: true,
        workflow_id: workflow.workflow_id,
        workflow,
      },
      { headers },
    );
  } catch (error) {
    console.error("Analysis start error:", error);
    return Response.json(
      {
        error: "Failed to start analysis",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers },
    );
  }
}
