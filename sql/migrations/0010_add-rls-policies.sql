ALTER TABLE "admin_activity_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_daily_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pricing_plan_features" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pricing_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "service_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "service_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_team_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_workflow_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_analysis_steps" DROP CONSTRAINT "work_analysis_steps_notes_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "work_analysis_steps" DROP COLUMN IF EXISTS "notes_author_id";--> statement-breakpoint
ALTER TABLE "work_analysis_steps" DROP COLUMN IF EXISTS "notes_updated_at";--> statement-breakpoint
CREATE POLICY "admin-only-activity-logs" ON "admin_activity_logs" AS RESTRICTIVE FOR ALL TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "admin-only-daily-stats" ON "admin_daily_stats" AS RESTRICTIVE FOR ALL TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "public-read-pricing-features" ON "pricing_plan_features" AS PERMISSIVE FOR SELECT TO "anon" USING (true);--> statement-breakpoint
CREATE POLICY "public-read-pricing-plans" ON "pricing_plans" AS PERMISSIVE FOR SELECT TO "anon" USING (true);--> statement-breakpoint
CREATE POLICY "public-read-service-items" ON "service_items" AS PERMISSIVE FOR SELECT TO "anon" USING (true);--> statement-breakpoint
CREATE POLICY "public-read-service-sections" ON "service_sections" AS PERMISSIVE FOR SELECT TO "anon" USING (true);--> statement-breakpoint
CREATE POLICY "team-invites-select" ON "work_team_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        "work_team_invites"."invited_by" = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM work_teams
          WHERE work_teams.team_id = "work_team_invites"."team_id"
            AND work_teams.owner_id = (select auth.uid())
        )
      );--> statement-breakpoint
CREATE POLICY "team-members-select" ON "work_team_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        EXISTS (
          SELECT 1 FROM work_team_members my_membership
          WHERE my_membership.team_id = "work_team_members"."team_id"
            AND my_membership.user_id = (select auth.uid())
            AND my_membership.status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM work_teams
          WHERE work_teams.team_id = "work_team_members"."team_id"
            AND work_teams.owner_id = (select auth.uid())
        )
      );--> statement-breakpoint
CREATE POLICY "team-owner-or-member-select" ON "work_teams" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        "work_teams"."owner_id" = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM work_team_members
          WHERE work_team_members.team_id = "work_teams"."team_id"
            AND work_team_members.user_id = (select auth.uid())
            AND work_team_members.status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "team-owner-modify" ON "work_teams" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("work_teams"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "team-owner-delete" ON "work_teams" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("work_teams"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "authenticated-create-team" ON "work_teams" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("work_teams"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "workflow-shares-select" ON "work_workflow_shares" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        "work_workflow_shares"."shared_by" = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM work_team_members
          WHERE work_team_members.member_id = "work_workflow_shares"."team_member_id"
            AND work_team_members.user_id = (select auth.uid())
        )
      );--> statement-breakpoint
CREATE POLICY "workflow-shares-delete" ON "work_workflow_shares" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("work_workflow_shares"."shared_by" = (select auth.uid()));