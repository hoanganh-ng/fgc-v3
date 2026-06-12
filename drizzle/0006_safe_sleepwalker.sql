CREATE TYPE "public"."collector_profile_source_access_state" AS ENUM('UNKNOWN', 'PUBLIC_ACCESSIBLE', 'JOIN_REQUIRED', 'JOIN_REQUESTED', 'JOINED_ACCESSIBLE', 'ACCESS_DENIED', 'LOGIN_REQUIRED', 'CHECKPOINT_REQUIRED', 'NEEDS_MANUAL_REVIEW');--> statement-breakpoint
CREATE TABLE "collector_profile_source_access" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"source_group_id" text NOT NULL,
	"access_state" "collector_profile_source_access_state" DEFAULT 'UNKNOWN' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_successful_at" timestamp with time zone,
	"last_failure_reason" jsonb,
	"join_requested_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collector_profile_source_access" ADD CONSTRAINT "collector_profile_source_access_profile_id_collector_profiles_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."collector_profiles"("profile_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collector_profile_source_access_profile_source_uidx" ON "collector_profile_source_access" USING btree ("profile_id","source_group_id");--> statement-breakpoint
CREATE INDEX "collector_profile_source_access_profile_id_idx" ON "collector_profile_source_access" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "collector_profile_source_access_source_group_id_idx" ON "collector_profile_source_access" USING btree ("source_group_id");--> statement-breakpoint
CREATE INDEX "collector_profile_source_access_state_idx" ON "collector_profile_source_access" USING btree ("access_state");--> statement-breakpoint
CREATE INDEX "collector_profile_source_access_updated_at_idx" ON "collector_profile_source_access" USING btree ("updated_at");