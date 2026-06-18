CREATE TYPE "public"."source_publisher_kind" AS ENUM('GROUP', 'PAGE');--> statement-breakpoint
CREATE TYPE "public"."source_publisher_status" AS ENUM('DISCOVERED', 'APPROVED', 'IGNORED', 'BLOCKED');--> statement-breakpoint
CREATE TABLE "source_publishers" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" "content_platform" NOT NULL,
	"kind" "source_publisher_kind" NOT NULL,
	"external_publisher_id" text NOT NULL,
	"display_name" text,
	"canonical_url" text,
	"status" "source_publisher_status" NOT NULL,
	"first_observed_at" timestamp with time zone NOT NULL,
	"last_observed_at" timestamp with time zone NOT NULL,
	"observation_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_publishers_observation_count_check" CHECK ("source_publishers"."observation_count" >= 1),
	CONSTRAINT "source_publishers_first_le_last_observed_at_check" CHECK ("source_publishers"."first_observed_at" <= "source_publishers"."last_observed_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "source_publishers_identity_uidx" ON "source_publishers" USING btree ("platform","kind","external_publisher_id");--> statement-breakpoint
CREATE INDEX "source_publishers_status_idx" ON "source_publishers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_publishers_kind_idx" ON "source_publishers" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "source_publishers_platform_idx" ON "source_publishers" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "source_publishers_last_observed_at_id_idx" ON "source_publishers" USING btree ("last_observed_at","id");