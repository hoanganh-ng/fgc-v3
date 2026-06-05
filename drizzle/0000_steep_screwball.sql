CREATE TYPE "public"."collector_profile_lease_status" AS ENUM('ACTIVE', 'RELEASED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."collector_profile_status" AS ENUM('PENDING_CONFIG', 'PENDING_LOGIN', 'READY', 'BUSY');--> statement-breakpoint
CREATE TYPE "public"."provisioning_token_status" AS ENUM('NOT_ISSUED', 'ISSUED', 'CONSUMED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "collector_profile_leases" (
	"lease_id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"status" "collector_profile_lease_status" DEFAULT 'ACTIVE' NOT NULL,
	"leased_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collector_profiles" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"status" "collector_profile_status" DEFAULT 'PENDING_CONFIG' NOT NULL,
	"provisioning_token_status" "provisioning_token_status" DEFAULT 'NOT_ISSUED' NOT NULL,
	"provisioning_token_hash" text,
	"provisioning_token_issued_at" timestamp with time zone,
	"provisioning_token_expires_at" timestamp with time zone,
	"provisioning_token_consumed_at" timestamp with time zone,
	"last_checkout_at" timestamp with time zone,
	"last_released_at" timestamp with time zone,
	"next_available_at" timestamp with time zone,
	"daily_usage_local_date" date,
	"daily_sessions_started" integer DEFAULT 0 NOT NULL,
	"daily_active_duration_minutes" integer DEFAULT 0 NOT NULL,
	"daily_macro_actions" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"identity_metadata" jsonb NOT NULL,
	"network_context" jsonb NOT NULL,
	"hardware_fingerprint" jsonb,
	"authentication_state" jsonb NOT NULL,
	"behavioral_persona" jsonb NOT NULL,
	"temporal_routine" jsonb NOT NULL,
	"safety_thresholds" jsonb NOT NULL,
	"content_affinities" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collector_profile_leases" ADD CONSTRAINT "collector_profile_leases_profile_id_collector_profiles_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."collector_profiles"("profile_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collector_profile_leases_profile_id_idx" ON "collector_profile_leases" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "collector_profile_leases_profile_status_idx" ON "collector_profile_leases" USING btree ("profile_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "collector_profile_leases_active_profile_uidx" ON "collector_profile_leases" USING btree ("profile_id") WHERE "collector_profile_leases"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "collector_profiles_status_idx" ON "collector_profiles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "collector_profiles_issued_token_hash_uidx" ON "collector_profiles" USING btree ("provisioning_token_hash") WHERE "collector_profiles"."provisioning_token_status" = 'ISSUED' and "collector_profiles"."provisioning_token_hash" is not null;--> statement-breakpoint
CREATE INDEX "collector_profiles_checkout_availability_idx" ON "collector_profiles" USING btree ("status","next_available_at");