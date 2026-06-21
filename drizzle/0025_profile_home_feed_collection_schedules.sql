CREATE TABLE "collector_profile_home_feed_collection_schedules" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"interval_minutes" integer NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"parameters" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collector_phf_schedules_interval_minutes_check" CHECK ("collector_profile_home_feed_collection_schedules"."interval_minutes" BETWEEN 1 AND 10080)
);
--> statement-breakpoint
CREATE INDEX "collector_phf_schedules_due_idx" ON "collector_profile_home_feed_collection_schedules" USING btree ("enabled","next_run_at","profile_id");--> statement-breakpoint
CREATE INDEX "collector_phf_schedules_next_idx" ON "collector_profile_home_feed_collection_schedules" USING btree ("next_run_at","profile_id");
