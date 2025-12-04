/**
 * Database Queries for Business Logic (Workflows)
 *
 * This module contains all database queries related to workflows and analysis steps.
 */
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";

import db from "~/core/db/drizzle-client.server";

import { workWorkflowMembers } from "../team-management/schema";
import { workTeamMembers } from "../team-management/team-schema";
import { workWorkflowShares } from "../team-management/team-shares-schema";
import { workAnalysisSteps, workWorkflows } from "./schema";

/**
 * Get all workflows for the current user with their steps
 * Includes workflows they own, team workflows, and shared workflows
 */
export async function getUserWorkflows(userId: string) {
  // 1. 사용자가 직접 소유한 워크플로우
  const ownedWorkflows = await db.query.workWorkflows.findMany({
    where: eq(workWorkflows.owner_id, userId),
    orderBy: desc(workWorkflows.created_at),
    with: {
      steps: true,
      sourceVideo: true,
      team: true,
    },
  });

  // 2. 사용자가 속한 활성 팀들 찾기
  const userTeams = await db
    .select({
      team_id: workTeamMembers.team_id,
      member_id: workTeamMembers.member_id,
    })
    .from(workTeamMembers)
    .where(
      and(
        eq(workTeamMembers.user_id, userId),
        eq(workTeamMembers.status, "active" as any),
      ),
    );

  if (userTeams.length === 0) {
    return ownedWorkflows;
  }

  const teamIds = userTeams.map((t) => t.team_id);

  // 3. 팀 워크플로우 조회 (팀 전체 공유)
  const teamWorkflows = await db.query.workWorkflows.findMany({
    where: inArray(workWorkflows.team_id, teamIds),
    orderBy: desc(workWorkflows.created_at),
    with: {
      steps: true,
      sourceVideo: true,
      team: true,
    },
  });

  // 4. 모든 워크플로우 합치고 중복 제거
  const allWorkflows = [...ownedWorkflows, ...teamWorkflows];

  // workflow_id로 중복 제거
  const uniqueWorkflows = allWorkflows.filter(
    (workflow, index, self) =>
      index === self.findIndex((w) => w.workflow_id === workflow.workflow_id),
  );

  // 생성일 순으로 정렬
  return uniqueWorkflows.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * Get a single workflow by ID with all its analysis steps
 * Checks if user has access to the workflow
 */
export async function getWorkflowWithSteps(workflowId: number, userId: string) {
  // 1. 워크플로우 조회
  const workflow = await db.query.workWorkflows.findFirst({
    where: eq(workWorkflows.workflow_id, workflowId),
    with: {
      steps: true,
    },
  });

  if (!workflow) {
    return null;
  }

  // 2. 접근 권한 확인
  // 2.1. 직접 소유한 워크플로우
  if (workflow.owner_id === userId) {
    return workflow;
  }

  // 2.2. 팀 워크플로우인 경우
  if (workflow.team_id) {
    // 사용자가 해당 팀의 활성 멤버인지 확인
    const [teamMember] = await db
      .select()
      .from(workTeamMembers)
      .where(
        and(
          eq(workTeamMembers.team_id, workflow.team_id),
          eq(workTeamMembers.user_id, userId),
          eq(workTeamMembers.status, "active" as any),
        ),
      )
      .limit(1);

    if (teamMember) {
      // 팀 전체 공유인지 확인
      const [shareRecord] = await db
        .select()
        .from(workWorkflowShares)
        .where(eq(workWorkflowShares.workflow_id, workflowId))
        .limit(1);

      // 공유 레코드가 없으면 팀 전체 공유
      if (!shareRecord) {
        return workflow;
      }

      // 특정 멤버에게 공유된 경우
      if (shareRecord.team_member_id === teamMember.member_id) {
        return workflow;
      }
    }
  }

  // 3. 레거시: 개별 워크플로우 멤버인 경우
  const [legacyMember] = await db
    .select()
    .from(workWorkflowMembers)
    .where(
      and(
        eq(workWorkflowMembers.workflow_id, workflowId),
        eq(workWorkflowMembers.user_id, userId),
        eq(workWorkflowMembers.status, "active" as any),
      ),
    )
    .limit(1);

  if (legacyMember) {
    return workflow;
  }

  // 접근 권한 없음
  return null;
}

/**
 * Get all analysis steps for a workflow
 */
export async function getWorkflowSteps(workflowId: number) {
  const steps = await db
    .select()
    .from(workAnalysisSteps)
    .where(eq(workAnalysisSteps.workflow_id, workflowId))
    .orderBy(workAnalysisSteps.sequence_no);

  return steps;
}

/**
 * Update a step's notes
 */
export async function updateStepNotes(
  stepId: number,
  notes: string,
): Promise<void> {
  await db
    .update(workAnalysisSteps)
    .set({ notes })
    .where(eq(workAnalysisSteps.step_id, stepId));
}

/**
 * Update a step's action and description
 */
export async function updateStepDetails(
  stepId: number,
  action: string,
  description: string,
): Promise<void> {
  await db
    .update(workAnalysisSteps)
    .set({ action, description })
    .where(eq(workAnalysisSteps.step_id, stepId));
}

/**
 * Delete a step
 */
export async function deleteStep(stepId: number): Promise<void> {
  await db
    .delete(workAnalysisSteps)
    .where(eq(workAnalysisSteps.step_id, stepId));
}

/**
 * Add a new step to a workflow at a specific position
 * Shifts all subsequent steps down by 1
 */
export async function addStep(
  workflowId: number,
  sequenceNo: number,
  action: string,
  description: string,
): Promise<void> {
  // First, shift all existing steps at or after this position down by 1
  await db
    .update(workAnalysisSteps)
    .set({ sequence_no: sql`sequence_no + 1` })
    .where(
      and(
        eq(workAnalysisSteps.workflow_id, workflowId),
        gte(workAnalysisSteps.sequence_no, sequenceNo),
      ),
    );

  // Then insert the new step at the specified position
  await db.insert(workAnalysisSteps).values({
    workflow_id: workflowId,
    sequence_no: sequenceNo,
    type: "click", // Default type
    action,
    description,
    confidence: 0,
  });
}

/**
 * Reorder steps by updating their sequence numbers
 */
export async function reorderSteps(
  workflowId: number,
  stepIds: number[],
): Promise<void> {
  // Update each step with its new sequence number
  await db.transaction(async (tx) => {
    for (let i = 0; i < stepIds.length; i++) {
      await tx
        .update(workAnalysisSteps)
        .set({ sequence_no: i + 1 })
        .where(
          and(
            eq(workAnalysisSteps.step_id, stepIds[i]),
            eq(workAnalysisSteps.workflow_id, workflowId),
          ),
        );
    }
  });
}

/**
 * Update step type
 */
export async function updateStepType(
  stepId: number,
  type: string,
): Promise<void> {
  await db
    .update(workAnalysisSteps)
    .set({ type: type as "input" | "click" | "wait" | "navigate" | "decision" })
    .where(eq(workAnalysisSteps.step_id, stepId));
}

/**
 * Update step screenshot URL
 */
export async function updateStepScreenshot(
  stepId: number,
  screenshotUrl: string | null,
): Promise<void> {
  await db
    .update(workAnalysisSteps)
    .set({ screenshot_url: screenshotUrl })
    .where(eq(workAnalysisSteps.step_id, stepId));
}

/**
 * Delete a workflow
 */
export async function deleteWorkflow(workflowId: number): Promise<void> {
  await db
    .delete(workWorkflows)
    .where(eq(workWorkflows.workflow_id, workflowId));
}
