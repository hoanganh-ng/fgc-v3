CREATE TYPE "public"."collector_profile_lease_purpose" AS ENUM('COLLECTION', 'AMBIENT_EXERCISE');--> statement-breakpoint
CREATE TYPE "public"."account_exercise_run_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."account_exercise_type" AS ENUM('AMBIENT_ACCOUNT');--> statement-breakpoint
CREATE TABLE "collector_account_exercise_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"lease_id" text,
	"exercise_type" "account_exercise_type" NOT NULL,
	"status" "account_exercise_run_status" NOT NULL,
	"stage_at_start" text NOT NULL,
	"action_budget" jsonb NOT NULL,
	"safe_summary" jsonb,
	"failure_reason" jsonb,
	"requested_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collector_profile_leases" ADD COLUMN "purpose" "collector_profile_lease_purpose" DEFAULT 'COLLECTION' NOT NULL;--> statement-breakpoint
CREATE INDEX "collector_account_exercise_runs_status_idx" ON "collector_account_exercise_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "collector_account_exercise_runs_profile_id_idx" ON "collector_account_exercise_runs" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "collector_account_exercise_runs_created_at_idx" ON "collector_account_exercise_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "collector_account_exercise_runs_requested_at_idx" ON "collector_account_exercise_runs" USING btree ("requested_at");