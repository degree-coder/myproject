import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { anonRole } from "drizzle-orm/supabase";

// Helper function moved inline to avoid server/client code splitting
const timestamps = {
  updated_at: timestamp().defaultNow().notNull(),
  created_at: timestamp().defaultNow().notNull(),
};

// 가격 플랜 - 공개 읽기 전용 (가격 페이지)
export const pricingPlans = pgTable(
  "pricing_plans",
  {
    plan_id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    name: varchar({ length: 100 }).notNull(),
    description: text(),
    price_monthly: integer().notNull(),
    price_yearly: integer(),
    currency: varchar({ length: 10 }).default("KRW"),
    is_popular: boolean().default(false),
    is_active: boolean().default(true),
    display_order: integer().default(0),
    created_at: timestamp().defaultNow(),
    updated_at: timestamp().defaultNow(),
  },
  () => [
    pgPolicy("public-read-pricing-plans", {
      for: "select",
      to: anonRole,
      as: "permissive",
      using: sql`true`,
    }),
  ],
);

// 가격 플랜 기능 - 공개 읽기 전용 (가격 페이지)
export const pricingPlanFeatures = pgTable(
  "pricing_plan_features",
  {
    feature_id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    plan_id: bigint({ mode: "number" })
      .references(() => pricingPlans.plan_id, { onDelete: "cascade" })
      .notNull(),
    feature_name: varchar({ length: 255 }).notNull(),
    feature_value: text(),
    is_included: boolean().default(true),
    display_order: integer().default(0),
    created_at: timestamp().defaultNow(),
  },
  () => [
    pgPolicy("public-read-pricing-features", {
      for: "select",
      to: anonRole,
      as: "permissive",
      using: sql`true`,
    }),
  ],
);

// Relations
export const pricingPlansRelations = relations(pricingPlans, ({ many }) => ({
  features: many(pricingPlanFeatures),
}));

export const pricingPlanFeaturesRelations = relations(
  pricingPlanFeatures,
  ({ one }) => ({
    plan: one(pricingPlans, {
      fields: [pricingPlanFeatures.plan_id],
      references: [pricingPlans.plan_id],
    }),
  }),
);
