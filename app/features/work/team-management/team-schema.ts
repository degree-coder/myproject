import { sql } from "drizzle-orm";
import {
  bigint,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

// Helper functions moved inline to avoid server/client code splitting
const timestamps = {
  updated_at: timestamp().defaultNow().notNull(),
  created_at: timestamp().defaultNow().notNull(),
};

function makeIdentityColumn(name: string) {
  return {
    [name]: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  };
}

// 팀 멤버 상태
export const teamMemberStatusEnum = pgEnum("team_member_status", [
  "active", // 활동중 (가입 완료)
  "pending", // 대기중 (초대만 됨)
  "inactive", // 비활성 (제외됨)
]);

// 팀 멤버 역할
export const teamMemberRoleEnum = pgEnum("team_member_role", [
  "owner", // 팀 소유자
  "admin", // 관리자
  "member", // 일반 멤버
]);

/**
 * 팀 테이블
 * - 최상위 엔티티
 * - 여러 워크플로우를 포함
 */
export const workTeams = pgTable(
  "work_teams",
  {
    team_id: uuid("team_id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    owner_id: uuid("owner_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    // 팀 소유자 또는 활성 멤버만 조회 가능
    pgPolicy("team-owner-or-member-select", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`
        ${t.owner_id} = ${authUid}
        OR EXISTS (
          SELECT 1 FROM work_team_members
          WHERE work_team_members.team_id = ${t.team_id}
            AND work_team_members.user_id = ${authUid}
            AND work_team_members.status = 'active'
        )
      `,
    }),
    // 팀 소유자만 수정/삭제 가능
    pgPolicy("team-owner-modify", {
      for: "update",
      to: authenticatedRole,
      as: "permissive",
      using: sql`${t.owner_id} = ${authUid}`,
    }),
    pgPolicy("team-owner-delete", {
      for: "delete",
      to: authenticatedRole,
      as: "permissive",
      using: sql`${t.owner_id} = ${authUid}`,
    }),
    // 인증된 사용자는 팀 생성 가능
    pgPolicy("authenticated-create-team", {
      for: "insert",
      to: authenticatedRole,
      as: "permissive",
      withCheck: sql`${t.owner_id} = ${authUid}`,
    }),
  ],
);

/**
 * 팀 멤버 테이블
 * - 팀에 속한 멤버 관리
 * - 상태: active(활동중), pending(대기중), inactive(제외됨)
 */
export const workTeamMembers = pgTable(
  "work_team_members",
  {
    member_id: uuid("member_id").primaryKey().defaultRandom(),
    team_id: uuid("team_id")
      .notNull()
      .references(() => workTeams.team_id, { onDelete: "cascade" }),
    user_id: uuid("user_id").references(() => authUsers.id, {
      onDelete: "cascade",
    }),
    email: text("email"), // 초대된 이메일 (가입 전)
    role: teamMemberRoleEnum("role").notNull().default("member"),
    status: teamMemberStatusEnum("status").notNull().default("pending"),
    invited_by: uuid("invited_by").references(() => authUsers.id),
    invited_at: timestamp("invited_at").defaultNow().notNull(),
    joined_at: timestamp("joined_at"),
    ...timestamps,
  },
  (t) => [
    // 같은 팀 멤버만 조회 가능
    pgPolicy("team-members-select", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`
        EXISTS (
          SELECT 1 FROM work_team_members my_membership
          WHERE my_membership.team_id = ${t.team_id}
            AND my_membership.user_id = ${authUid}
            AND my_membership.status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM work_teams
          WHERE work_teams.team_id = ${t.team_id}
            AND work_teams.owner_id = ${authUid}
        )
      `,
    }),
  ],
);

/**
 * 팀 초대 토큰 테이블
 * - 이메일/링크 기반 초대
 */
export const workTeamInvites = pgTable(
  "work_team_invites",
  {
    invite_id: uuid("invite_id").primaryKey().defaultRandom(),
    team_id: uuid("team_id")
      .notNull()
      .references(() => workTeams.team_id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: teamMemberRoleEnum("role").notNull().default("member"),
    token: text("token").notNull().unique(),
    invited_by: uuid("invited_by")
      .notNull()
      .references(() => authUsers.id),
    expires_at: timestamp("expires_at").notNull(),
    accepted_at: timestamp("accepted_at"),
    ...timestamps,
  },
  (t) => [
    // 초대한 사람 또는 팀 소유자만 조회 가능
    pgPolicy("team-invites-select", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`
        ${t.invited_by} = ${authUid}
        OR EXISTS (
          SELECT 1 FROM work_teams
          WHERE work_teams.team_id = ${t.team_id}
            AND work_teams.owner_id = ${authUid}
        )
      `,
    }),
  ],
);
