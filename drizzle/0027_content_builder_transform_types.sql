CREATE TYPE "public"."transform_type_status" AS ENUM('ACTIVE', 'ARCHIVED');
--> statement-breakpoint
CREATE TABLE "content_builder_transform_types" (
	"transform_type_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"description" text,
	"initial_prompt" text NOT NULL,
	"status" "transform_type_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "content_builder_transform_types_active_name_uidx"
  ON "content_builder_transform_types" USING btree ("normalized_name")
  WHERE "status" <> 'ARCHIVED';
--> statement-breakpoint
CREATE INDEX "content_builder_transform_types_status_idx"
  ON "content_builder_transform_types" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "content_builder_transform_types_created_at_idx"
  ON "content_builder_transform_types" USING btree ("created_at", "transform_type_id");
