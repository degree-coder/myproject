import type { ActionFunctionArgs } from "react-router";

import { and, eq } from "drizzle-orm";
import { data } from "react-router";

import db from "~/core/db/drizzle-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import makeServerClient from "~/core/lib/supa-client.server";
import { workWorkflows } from "~/features/work/business-logic/schema";
import { workVideos } from "~/features/work/upload/schema";

export async function action({ request, params }: ActionFunctionArgs) {
  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  const workflowId = parseInt(params.workflowId!);

  if (isNaN(workflowId)) {
    return data({ error: "Invalid workflow ID" }, { status: 400 });
  }

  try {
    // Check ownership
    const [workflow] = await db
      .select()
      .from(workWorkflows)
      .where(
        and(
          eq(workWorkflows.workflow_id, workflowId),
          eq(workWorkflows.owner_id, user.id),
        ),
      )
      .limit(1);

    if (!workflow) {
      return data(
        { error: "Workflow not found or unauthorized" },
        { status: 404 },
      );
    }

    // video_id 저장
    const sourceVideoId = workflow.source_video_id;
    console.log(
      `[Delete] Processing workflow ${workflowId}, sourceVideoId: ${sourceVideoId}`,
    );

    // 1. 동영상 삭제 우선 시도 (DB 및 Storage)
    if (sourceVideoId) {
      const [video] = await db
        .select()
        .from(workVideos)
        .where(eq(workVideos.video_id, sourceVideoId))
        .limit(1);

      if (video) {
        console.log(
          `[Delete] Found video record: ${video.video_id}, path: ${video.storage_path}`,
        );

        // Storage 파일 삭제
        if (video.storage_path) {
          // 디버깅: 삭제 전 파일 목록 확인
          try {
            const userId = video.owner_id; // Using owner_id as folder name based on upload logic
            const { data: fileList, error: listError } =
              await adminClient.storage
                .from("work-videos")
                .list(userId || undefined);

            console.log(
              `[Delete] Files in folder '${userId}':`,
              fileList?.map((f) => f.name),
            );
            if (listError) console.error("[Delete] List error:", listError);
          } catch (e) {
            console.error("[Delete] List exception:", e);
          }

          const { data: removeData, error: storageError } =
            await adminClient.storage
              .from("work-videos")
              .remove([video.storage_path]);

          if (storageError) {
            console.warn(
              "Failed to delete video file from storage:",
              storageError,
            );
          } else {
            console.log("[Delete] Storage file removed:", removeData);
          }
        } else {
          console.warn("[Delete] No storage_path for video");
        }

        // DB 레코드 삭제 (Cascade: set null on workWorkflows)
        await db
          .delete(workVideos)
          .where(eq(workVideos.video_id, sourceVideoId));
        console.log(`[Delete] Video record deleted from DB`);
      } else {
        console.warn(`[Delete] Video record not found for ID ${sourceVideoId}`);
      }
    } else {
      console.log(`[Delete] No source video encoded in workflow`);
    }

    // 2. 워크플로우 삭제
    await db
      .delete(workWorkflows)
      .where(eq(workWorkflows.workflow_id, workflowId));
    console.log(`[Delete] Workflow record deleted`);

    return data({ success: true });
  } catch (error: any) {
    console.error("Delete workflow error:", error);
    return data(
      { error: error.message || "Failed to delete workflow" },
      { status: 500 },
    );
  }
}
