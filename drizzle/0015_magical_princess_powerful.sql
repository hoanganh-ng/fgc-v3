CREATE TABLE "collector_collection_schedules" (
	"source_group_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"interval_minutes" integer NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"parameters" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collector_collection_schedules_interval_minutes_check" CHECK ("collector_collection_schedules"."interval_minutes" BETWEEN 1 AND 10080)
);
--> statement-breakpoint
CREATE INDEX "collector_collection_schedules_due_idx" ON "collector_collection_schedules" USING btree ("enabled","next_run_at","source_group_id");