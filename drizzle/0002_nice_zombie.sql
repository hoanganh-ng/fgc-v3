CREATE TYPE "public"."collection_run_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."collection_run_trigger_type" AS ENUM('MANUAL_API');--> statement-breakpoint
CREATE TABLE "collector_collection_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"source_group_id" text NOT NULL,
	"status" "collection_run_status" NOT NULL,
	"trigger_type" "collection_run_trigger_type" NOT NULL,
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
CREATE INDEX "collector_collection_runs_status_idx" ON "collector_collection_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "collector_collection_runs_source_group_id_idx" ON "collector_collection_runs" USING btree ("source_group_id");--> statement-breakpoint
CREATE INDEX "collector_collection_runs_created_at_idx" ON "collector_collection_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "collector_collection_runs_requested_at_idx" ON "collector_collection_runs" USING btree ("requested_at");