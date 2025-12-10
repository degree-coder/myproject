import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { workTeams } from "../team-management/team-schema";
import { workVideos } from "../upload/schema";

// Helper function moved inline to avoid server/client code splitting
const timestamps = {
  updated_at: timestamp().defaultNow().notNull(),
  created_at: timestamp().defaultNow().notNull(),
};

export const stepType = pgEnum("step_type", [
  "click",
  "input",
  "navigate",
  "wait",
  "decision",
]);

export const workflowStatus = pgEnum("workflow_status", [
  "analyzed",
  "analyzing",
  "pending",
]);

export const workWorkflows = pgTable(
  "work_workflows",
  {
    workflow_id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    owner_id: uuid().references(() => authUsers.id, { onDelete: "cascade" }),
    team_id: uuid().references(() => workTeams.team_id, {
      onDelete: "cascade",
    }),
    title: text().notNull(),
    description: text(),
    source_video_id: bigint({ mode: "number" }).references(
      () => workVideos.video_id,
      { onDelete: "set null" },
    ),
    duration_seconds: doublePrecision(),
    thumbnail_url: text(),
    status: workflowStatus().notNull().default("analyzing"),
    is_demo: boolean().notNull().default(false),
    requested_at: timestamp(),
    completed_at: timestamp(),
    ...timestamps,
  },
  (t) => [
    pgPolicy("workflow-owner-full-access", {
      for: "all",
      to: authenticatedRole,
      as: "permissive",
      using: sql`${authUid} = ${t.owner_id}`,
      withCheck: sql`${authUid} = ${t.owner_id}`,
    }),
    pgPolicy("team-members-access-workflows", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`
        ${t.team_id} IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM work_team_members tm
          WHERE tm.team_id = ${t.team_id}
            AND tm.user_id = ${authUid}
            AND tm.status = 'active'
        OR (
          ${t.team_id} IS NOT NULL 
          AND EXISTS (
            SELECT 1 FROM work_team_members tm
            WHERE tm.team_id = ${t.team_id}
              AND tm.user_id = ${authUid}
              AND tm.status = 'active'
          )
        )
        OR EXISTS (
          SELECT 1 FROM work_workflow_members m
          WHERE m.workflow_id = ${t.workflow_id}
            AND m.user_id = ${authUid}
            AND m.status = 'active'
        )
      `,
    }),
  ],
);

export const workAnalysisSteps = pgTable(
  "work_analysis_steps",
  {
    step_id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    workflow_id: bigint({ mode: "number" })
      .references(() => workWorkflows.workflow_id, { onDelete: "cascade" })
      .notNull(),
    sequence_no: integer().notNull(),
    type: stepType().notNull(),
    action: text().notNull(),
    description: text().notNull(),
    timestamp_label: text(),
    timestamp_seconds: doublePrecision(),
    confidence: integer(),
    screenshot_url: text(),
    notes: text(),
    ...timestamps,
  },
  (t) => [
    // RLS Policy: 워크플로우 접근 권한에 따라 스텝 접근 제어
    pgPolicy("workflow-based-step-access", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`
        EXISTS (
          SELECT 1 FROM work_workflows w
          WHERE w.workflow_id = ${t.workflow_id}
            AND (
              ${authUid} = w.owner_id
              OR (
                w.team_id IS NOT NULL 
                AND EXISTS (
                  SELECT 1 FROM work_team_members tm
                  WHERE tm.team_id = w.team_id
                    AND tm.user_id = ${authUid}
                    AND tm.status = 'active'
                )
              )
            )
            OR EXISTS (
              SELECT 1 FROM work_workflow_members m
              WHERE m.workflow_id = w.workflow_id
                AND m.user_id = ${authUid}
                AND m.status = 'active'
            )
          )
        )
      `,
    }),
    // RLS Policy: 워크플로우 소유자는 스텝 수정 가능
    pgPolicy("workflow-owner-edit-steps", {
      for: "update",
      to: authenticatedRole,
      as: "permissive",
      using: sql`
        EXISTS (
          SELECT 1 FROM work_workflows w
          WHERE w.workflow_id = ${t.workflow_id}
            AND w.owner_id = ${authUid}
        )
      `,
      withCheck: sql`
        EXISTS (
          SELECT 1 FROM work_workflows w
          WHERE w.workflow_id = ${t.workflow_id}
            AND w.owner_id = ${authUid}
        )
      `,
    }),
  ],
);

// Relations
export const workWorkflowsRelations = relations(
  workWorkflows,
  ({ many, one }) => ({
    steps: many(workAnalysisSteps),
    sourceVideo: one(workVideos, {
      fields: [workWorkflows.source_video_id],
      references: [workVideos.video_id],
    }),
    team: one(workTeams, {
      fields: [workWorkflows.team_id],
      references: [workTeams.team_id],
    }),
  }),
);

export const workAnalysisStepsRelations = relations(
  workAnalysisSteps,
  ({ one }) => ({
    workflow: one(workWorkflows, {
      fields: [workAnalysisSteps.workflow_id],
      references: [workWorkflows.workflow_id],
    }),
  }),
);
