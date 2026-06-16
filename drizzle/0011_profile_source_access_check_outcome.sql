CREATE TYPE "public"."profile_source_access_check_run_outcome" AS ENUM('PUBLIC_ACCESSIBLE', 'JOIN_REQUIRED', 'JOINED_ACCESSIBLE', 'ACCESS_DENIED', 'LOGIN_REQUIRED', 'CHECKPOINT_REQUIRED', 'NEEDS_MANUAL_REVIEW');--> statement-breakpoint
ALTER TABLE "collector_profile_source_access_check_runs" ADD COLUMN "outcome" "profile_source_access_check_run_outcome";--> statement-breakpoint
