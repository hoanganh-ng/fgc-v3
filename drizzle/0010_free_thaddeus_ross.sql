CREATE TYPE "public"."profile_source_access_check_run_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."profile_source_access_check_run_trigger_type" AS ENUM('MANUAL');--> statement-breakpoint
CREATE TABLE "collector_profile_source_access_check_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"source_group_id" text NOT NULL,
	"trigger_type" "profile_source_access_check_run_trigger_type" NOT NULL,
	"status" "profile_source_access_check_run_status" NOT NULL,
	"account_stage_at_request" text NOT NULL,
	"target" jsonb NOT NULL,
	"failure_reason" jsonb,
	"requested_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "collector_psa_check_runs_status_idx" ON "collector_profile_source_access_check_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "collector_psa_check_runs_profile_id_idx" ON "collector_profile_source_access_check_runs" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "collector_psa_check_runs_source_group_id_idx" ON "collector_profile_source_access_check_runs" USING btree ("source_group_id");--> statement-breakpoint
CREATE INDEX "collector_psa_check_runs_created_at_idx" ON "collector_profile_source_access_check_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "collector_psa_check_runs_requested_at_idx" ON "collector_profile_source_access_check_runs" USING btree ("requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "collector_psa_check_runs_active_unique_idx" ON "collector_profile_source_access_check_runs" USING btree ("profile_id","source_group_id") WHERE status IN ('QUEUED', 'RUNNING');