ALTER TYPE "public"."account_exercise_type" ADD VALUE 'CATEGORY_BROWSE';--> statement-breakpoint
ALTER TABLE "collector_account_exercise_runs" ADD COLUMN "target" jsonb;