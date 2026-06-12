CREATE TYPE "public"."collector_profile_account_stage" AS ENUM('NEW_ACCOUNT', 'WARMING', 'COLLECTION_READY', 'LIMITED', 'NEEDS_REVIEW', 'RETIRED');--> statement-breakpoint
DROP INDEX "collector_profiles_checkout_availability_idx";--> statement-breakpoint
ALTER TABLE "collector_profiles" ADD COLUMN "account_stage" "collector_profile_account_stage" DEFAULT 'NEW_ACCOUNT' NOT NULL;--> statement-breakpoint
CREATE INDEX "collector_profiles_account_stage_idx" ON "collector_profiles" USING btree ("account_stage");--> statement-breakpoint
CREATE INDEX "collector_profiles_checkout_availability_idx" ON "collector_profiles" USING btree ("status","account_stage","next_available_at");