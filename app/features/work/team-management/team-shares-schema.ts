import { sql } from "drizzle-orm";
import {
  bigint,
  pgPolicy,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { workWorkflows } from "../business-logic/schema";
import { workTeamMembers } from "./team-schema";

// Helper functions moved inline to avoid server/client code splitting
const timestamps = {
  updated_at: timestamp().defaultNow().notNull(),
  created_at: timestamp().defaultNow().notNull(),
};

/**
 * 워크플로우 공유 테이블
 * - 팀 내 워크플로우를 특정 멤버에게만 공유
 * - 레코드가 없으면 팀 전체 공유, 있으면 특정 멤버만 접근
 */
export const workWorkflowShares = pgTable(
  "work_workflow_shares",
  {
    share_id: uuid("share_id").primaryKey().defaultRandom(),
    workflow_id: bigint({ mode: "number" })
      .notNull()
      .references(() => workWorkflows.workflow_id, { onDelete: "cascade" }),
    team_member_id: uuid("team_member_id")
      .notNull()
      .references(() => workTeamMembers.member_id, { onDelete: "cascade" }),
    shared_by: uuid("shared_by")
      .notNull()
      .references(() => authUsers.id),
    ...timestamps,
  },
  (t) => [
    // 공유한 사람 또는 공유받은 멤버만 조회 가능
    pgPolicy("workflow-shares-select", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`
        ${t.shared_by} = ${authUid}
        OR EXISTS (
          SELECT 1 FROM work_team_members
          WHERE work_team_members.member_id = ${t.team_member_id}
            AND work_team_members.user_id = ${authUid}
        )
      `,
    }),
    // 공유한 사람만 삭제 가능
    pgPolicy("workflow-shares-delete", {
      for: "delete",
      to: authenticatedRole,
      as: "permissive",
      using: sql`${t.shared_by} = ${authUid}`,
    }),
  ],
);
