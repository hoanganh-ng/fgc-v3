CREATE TYPE "public"."profile_home_feed_collection_run_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."profile_home_feed_collection_run_trigger_type" AS ENUM('MANUAL_API');--> statement-breakpoint
CREATE TABLE "profile_home_feed_collection_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"trigger_type" "profile_home_feed_collection_run_trigger_type" NOT NULL,
	"status" "profile_home_feed_collection_run_status" NOT NULL,
	"account_stage_at_request" text NOT NULL,
	"target" jsonb NOT NULL,
	"parameters" jsonb NOT NULL,
	"summary" jsonb,
	"failure_reason" jsonb,
	"requested_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "profile_home_feed_collection_runs_status_idx" ON "profile_home_feed_collection_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "profile_home_feed_collection_runs_profile_id_idx" ON "profile_home_feed_collection_runs" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "profile_home_feed_collection_runs_created_at_idx" ON "profile_home_feed_collection_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "profile_home_feed_collection_runs_requested_at_id_idx" ON "profile_home_feed_collection_runs" USING btree ("requested_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_home_feed_collection_runs_active_profile_uidx" ON "profile_home_feed_collection_runs" USING btree ("profile_id") WHERE status IN ('QUEUED', 'RUNNING');
