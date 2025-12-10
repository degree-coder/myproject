CREATE TABLE IF NOT EXISTS "work_workflow_shares" (
	"share_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" bigint NOT NULL,
	"team_member_id" uuid NOT NULL,
	"shared_by" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feature_flags" (
	"flag_id" serial PRIMARY KEY NOT NULL,
	"feature_key" varchar(100) NOT NULL,
	"feature_name" varchar(255) NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT false,
	"disabled_message" varchar(255) DEFAULT '추후 공개 예정',
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "feature_flags_feature_key_unique" UNIQUE("feature_key")
);
--> statement-breakpoint
ALTER TABLE "work_analysis_steps" ADD COLUMN "notes_author_id" uuid;--> statement-breakpoint
ALTER TABLE "work_analysis_steps" ADD COLUMN "notes_updated_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_workflow_shares" ADD CONSTRAINT "work_workflow_shares_workflow_id_work_workflows_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."work_workflows"("workflow_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_workflow_shares" ADD CONSTRAINT "work_workflow_shares_team_member_id_work_team_members_member_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."work_team_members"("member_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_workflow_shares" ADD CONSTRAINT "work_workflow_shares_shared_by_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_analysis_steps" ADD CONSTRAINT "work_analysis_steps_notes_author_id_users_id_fk" FOREIGN KEY ("notes_author_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
