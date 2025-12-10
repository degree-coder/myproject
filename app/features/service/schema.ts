import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgPolicy,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { anonRole } from "drizzle-orm/supabase";

// 서비스 섹션 - 공개 읽기 전용 (랜딩 페이지)
export const serviceSections = pgTable(
  "service_sections",
  {
    section_id: serial("section_id").primaryKey(),
    section_key: varchar("section_key", { length: 100 }).notNull().unique(),
    title: text("title"),
    subtitle: text("subtitle"),
    description: text("description"),
    badge_text: varchar("badge_text", { length: 100 }),
    is_active: boolean("is_active").default(true),
    display_order: integer("display_order").default(0),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  () => [
    pgPolicy("public-read-service-sections", {
      for: "select",
      to: anonRole,
      as: "permissive",
      using: sql`true`,
    }),
  ],
);

// 서비스 항목 - 공개 읽기 전용 (랜딩 페이지)
export const serviceItems = pgTable(
  "service_items",
  {
    item_id: serial("item_id").primaryKey(),
    section_key: varchar("section_key", { length: 100 }).notNull(),
    item_type: varchar("item_type", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 100 }),
    display_order: integer("display_order").default(0),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at").defaultNow(),
  },
  () => [
    pgPolicy("public-read-service-items", {
      for: "select",
      to: anonRole,
      as: "permissive",
      using: sql`true`,
    }),
  ],
);
