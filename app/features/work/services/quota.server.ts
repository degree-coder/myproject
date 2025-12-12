import { eq, sql } from "drizzle-orm";

import db from "~/core/db/drizzle-client.server";
import { workWorkflows } from "~/features/work/business-logic/schema";
import { workVideos } from "~/features/work/upload/schema";

// Quota Limits (User requested)
const MAX_STORAGE_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_WORKFLOW_COUNT = 7;

/**
 * Checks if the user has enough storage quota for the new file.
 * Throws an error if quota is exceeded.
 */
export async function checkStorageQuota(userId: string, newSizeBytes: number) {
  // 1. Single file size check
  if (newSizeBytes > MAX_FILE_SIZE) {
    throw new Error(
      `파일 크기 제한 초과: 한 번에 최대 ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB까지만 업로드할 수 있습니다.`,
    );
  }

  // 2. Total storage check
  const result = await db
    .select({
      totalSize: sql<number>`sum(${workVideos.file_size})`,
    })
    .from(workVideos)
    .where(eq(workVideos.owner_id, userId));

  const currentUsage = result[0]?.totalSize || 0;
  const projectedUsage = Number(currentUsage) + newSizeBytes;

  if (projectedUsage > MAX_STORAGE_BYTES) {
    const remaining = MAX_STORAGE_BYTES - Number(currentUsage);
    const remainingMb = (remaining / (1024 * 1024)).toFixed(2);
    throw new Error(
      `저장 공간 부족: 남은 용량은 약 ${remainingMb}MB 입니다. (파일 크기: ${(newSizeBytes / (1024 * 1024)).toFixed(2)}MB)`,
    );
  }
}

/**
 * Checks if the user has reached the maximum number of workflows.
 * Throws an error if quota is exceeded.
 */
export async function checkWorkflowQuota(userId: string) {
  // Count current workflows
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(workWorkflows)
    .where(eq(workWorkflows.owner_id, userId));

  const currentCount = result[0]?.count || 0;

  if (currentCount >= MAX_WORKFLOW_COUNT) {
    throw new Error(
      `업무 프로세스 생성 한도 초과: 최대 ${MAX_WORKFLOW_COUNT}개까지 생성할 수 있습니다.`,
    );
  }
}

/**
 * Returns current quota usage stats for the user.
 */
export async function getUserQuotaStats(userId: string) {
  // 1. Storage Usage
  const storageResult = await db
    .select({
      totalSize: sql<number>`sum(${workVideos.file_size})`,
    })
    .from(workVideos)
    .where(eq(workVideos.owner_id, userId));

  const usedStorage = Number(storageResult[0]?.totalSize || 0);

  // 2. Workflow Limit
  const workflowResult = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(workWorkflows)
    .where(eq(workWorkflows.owner_id, userId));

  const usedWorkflows = Number(workflowResult[0]?.count || 0);

  return {
    storage: {
      used: usedStorage,
      max: MAX_STORAGE_BYTES,
      label: `${(usedStorage / (1024 * 1024)).toFixed(1)}MB / ${(MAX_STORAGE_BYTES / (1024 * 1024)).toFixed(0)}MB`,
      percentage: Math.min((usedStorage / MAX_STORAGE_BYTES) * 100, 100),
    },
    workflows: {
      used: usedWorkflows,
      max: MAX_WORKFLOW_COUNT,
      label: `${usedWorkflows} / ${MAX_WORKFLOW_COUNT}개`,
      percentage: Math.min((usedWorkflows / MAX_WORKFLOW_COUNT) * 100, 100),
    },
    fileLimit: {
      max: MAX_FILE_SIZE,
      label: `${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB`,
    },
  };
}
