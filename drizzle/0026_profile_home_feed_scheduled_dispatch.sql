ALTER TYPE "public"."profile_home_feed_collection_run_trigger_type" ADD VALUE 'SCHEDULED';
--> statement-breakpoint
ALTER TABLE "collector_profile_home_feed_collection_schedules"
  ADD COLUMN "last_attempted_at" timestamp with time zone,
  ADD COLUMN "last_dispatch_status" text,
  ADD COLUMN "last_failure_reason" jsonb,
  ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL,
  ADD CONSTRAINT "collector_phf_schedules_last_dispatch_status_check"
    CHECK ("last_dispatch_status" IS NULL OR "last_dispatch_status" IN ('DISPATCHED', 'SKIPPED_ACTIVE_RUN', 'PROFILE_NOT_FOUND', 'PROFILE_LOOKUP_FAILED')),
  ADD CONSTRAINT "collector_phf_schedules_consecutive_failures_check"
    CHECK ("consecutive_failures" >= 0);
