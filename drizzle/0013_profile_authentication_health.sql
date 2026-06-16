CREATE TYPE "public"."collector_profile_authentication_health" AS ENUM('NOT_PROVISIONED', 'HEALTHY', 'REAUTH_REQUIRED', 'CHECKPOINT_REVIEW_REQUIRED');--> statement-breakpoint
ALTER TABLE "collector_profiles" ADD COLUMN "authentication_health" "collector_profile_authentication_health" NOT NULL DEFAULT 'NOT_PROVISIONED';--> statement-breakpoint
ALTER TABLE "collector_profiles" ADD COLUMN "authentication_health_updated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "collector_profiles"
SET "authentication_health" = CASE
  WHEN "status" IN ('READY', 'BUSY') THEN 'HEALTHY'::"collector_profile_authentication_health"
  ELSE 'NOT_PROVISIONED'::"collector_profile_authentication_health"
END,
"authentication_health_updated_at" = COALESCE("updated_at", "created_at")
WHERE "authentication_health_updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "collector_profiles" ALTER COLUMN "authentication_health_updated_at" SET NOT NULL;--> statement-breakpoint
