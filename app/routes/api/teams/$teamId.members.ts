import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { and, eq } from "drizzle-orm";
import { data } from "react-router";

import db from "~/core/db/drizzle-client.server";
import makeServerClient from "~/core/lib/supa-client.server";
import { sendTeamInviteEmail } from "~/features/email/services/email.service";
import {
  workTeamInvites,
  workTeamMembers,
  workTeams,
} from "~/features/work/team-management/team-schema";

/**
 * 사용자가 팀의 owner/admin인지 확인
 */
async function checkAdminPermission(
  teamId: string,
  userId: string,
): Promise<boolean> {
  const [team] = await db
    .select()
    .from(workTeams)
    .where(eq(workTeams.team_id, teamId as any))
    .limit(1);

  if (!team) return false;
  if (team.owner_id === userId) return true;

  const [member] = await db
    .select()
    .from(workTeamMembers)
    .where(
      and(
        eq(workTeamMembers.team_id, teamId as any),
        eq(workTeamMembers.user_id, userId as any),
        eq(workTeamMembers.status, "active" as any),
      ),
    )
    .limit(1);

  return member?.role === "admin" || member?.role === "owner";
}

/**
 * GET /api/teams/:teamId/members
 * 팀 멤버 목록 + 현재 사용자 역할 조회
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return data({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = params;
  if (!teamId) return data({ error: "Team ID required" }, { status: 400 });

  // 팀 접근 권한 확인
  const [team] = await db
    .select()
    .from(workTeams)
    .where(eq(workTeams.team_id, teamId as any))
    .limit(1);

  if (!team) return data({ error: "Team not found" }, { status: 404 });

  const isOwner = team.owner_id === user.id;
  const [myMembership] = await db
    .select()
    .from(workTeamMembers)
    .where(
      and(
        eq(workTeamMembers.team_id, teamId as any),
        eq(workTeamMembers.user_id, user.id as any),
      ),
    )
    .limit(1);

  if (!isOwner && (!myMembership || myMembership.status !== "active")) {
    return data({ error: "Forbidden" }, { status: 403 });
  }

  // 멤버 목록 조회
  const members = await db
    .select()
    .from(workTeamMembers)
    .where(eq(workTeamMembers.team_id, teamId as any));

  // 현재 사용자 역할
  let myRole: "owner" | "admin" | "member" | null = null;
  if (isOwner) {
    myRole = "owner";
  } else if (myMembership) {
    myRole = myMembership.role as any;
  }

  return data({ members, myRole, currentUserId: user.id });
}

/**
 * POST /api/teams/:teamId/members
 * 팀원 초대 (이메일로 pending 상태 멤버 생성)
 */
export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return data({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = params;
  if (!teamId) return data({ error: "Team ID required" }, { status: 400 });

  // Admin 권한 확인
  const isAdmin = await checkAdminPermission(teamId, user.id);
  if (!isAdmin) {
    return data({ error: "Admin permission required" }, { status: 403 });
  }

  const body = await request.json();
  const { email, role = "member" } = body;

  if (!email || typeof email !== "string") {
    return data({ error: "Email is required" }, { status: 400 });
  }

  // 이미 초대된/가입된 멤버인지 확인
  const [existing] = await db
    .select()
    .from(workTeamMembers)
    .where(
      and(
        eq(workTeamMembers.team_id, teamId as any),
        eq(workTeamMembers.email, email),
      ),
    )
    .limit(1);

  let member;

  if (existing) {
    // 활성 상태인 멤버는 재초대 불가
    if (existing.status === "active") {
      return data({ error: "이미 팀에 가입된 멤버입니다" }, { status: 409 });
    }

    // pending 또는 inactive 상태인 경우 재초대 허용
    // 멤버 정보 업데이트 (역할, 초대자, 초대일 갱신)
    const [updatedMember] = await db
      .update(workTeamMembers)
      .set({
        role: role as any,
        status: "pending" as any,
        invited_by: user.id as any,
        invited_at: new Date(),
      })
      .where(eq(workTeamMembers.member_id, existing.member_id))
      .returning();

    member = updatedMember;
  } else {
    // 신규 멤버 추가
    const [newMember] = await db
      .insert(workTeamMembers)
      .values({
        team_id: teamId as any,
        user_id: null, // 가입 전에는 null
        email,
        role: role as any,
        status: "pending" as any,
        invited_by: user.id as any,
        invited_at: new Date(),
      })
      .returning();

    member = newMember;
  }

  // 초대 토큰 생성 (7일 유효)
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // 기존 초대 토큰이 있으면 만료 처리
  await db
    .update(workTeamInvites)
    .set({ expires_at: new Date() }) // 즉시 만료
    .where(
      and(
        eq(workTeamInvites.team_id, teamId as any),
        eq(workTeamInvites.email, email),
      ),
    );

  // 새 초대 토큰 생성
  await db.insert(workTeamInvites).values({
    team_id: teamId as any,
    email,
    role: role as any,
    token,
    invited_by: user.id as any,
    expires_at: expiresAt,
  });

  // 팀 정보 조회 (이메일 발송용)
  const [team] = await db
    .select()
    .from(workTeams)
    .where(eq(workTeams.team_id, teamId as any))
    .limit(1);

  if (team) {
    const origin = new URL(request.url).origin;
    const inviteUrl = `${origin}/work/invite/${token}`;
    const inviterName = user.user_metadata?.full_name || user.email || "관리자";

    // 이메일 발송 (비동기 처리, 에러가 발생해도 초대는 생성됨)
    sendTeamInviteEmail({
      to: email,
      teamName: team.name,
      inviterName,
      role: role as string,
      inviteUrl,
    }).catch((e) => {
      console.error("Failed to send invite email:", e);
    });
  }

  return data({ member, inviteToken: token }, { status: 201 });
}
