UPDATE "collector_profile_source_access_check_runs"
SET "outcome" = 'NEEDS_MANUAL_REVIEW'
WHERE "status" = 'SUCCEEDED'
  AND "outcome" IS NULL;--> statement-breakpoint
