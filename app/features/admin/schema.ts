import { sql } from "drizzle-orm";
import {
  date,
  integer,
  pgPolicy,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

// 관리자 일일 통계 - 서버 전용 (service_role만 접근, 클라이언트 차단)
export const adminDailyStats = pgTable(
  "admin_daily_stats",
  {
    id: serial("id").primaryKey(),
    stat_date: date("stat_date").notNull(),
    total_users: integer("total_users").notNull().default(0),
    new_users: integer("new_users").notNull().default(0),
    total_workflows: integer("total_workflows").notNull().default(0),
    new_workflows: integer("new_workflows").notNull().default(0),
    total_analyses: integer("total_analyses").notNull().default(0),
    new_analyses: integer("new_analyses").notNull().default(0),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  () => [
    // RLS 활성화하되 클라이언트 접근 차단 (service_role만 접근)
    pgPolicy("admin-only-daily-stats", {
      for: "all",
      to: authenticatedRole,
      as: "restrictive",
      using: sql`false`,
    }),
  ],
);

// 관리자 활동 로그 - 서버 전용 (service_role만 접근, 클라이언트 차단)
export const adminActivityLogs = pgTable(
  "admin_activity_logs",
  {
    id: serial("id").primaryKey(),
    occurred_at: timestamp("occurred_at").defaultNow().notNull(),
    user_id: uuid("user_id"),
    event_type: text("event_type").notNull(),
    detail: text("detail"),
  },
  () => [
    // RLS 활성화하되 클라이언트 접근 차단 (service_role만 접근)
    pgPolicy("admin-only-activity-logs", {
      for: "all",
      to: authenticatedRole,
      as: "restrictive",
      using: sql`false`,
    }),
  ],
);
