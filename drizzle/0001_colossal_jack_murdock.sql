CREATE TYPE "public"."content_platform" AS ENUM('FACEBOOK');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('COLLECTED', 'SELECTED', 'REJECTED', 'USED');--> statement-breakpoint
CREATE TYPE "public"."source_group_status" AS ENUM('ACTIVE', 'PAUSED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "content_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" "content_platform" NOT NULL,
	"source_group_id" text NOT NULL,
	"external_post_id" text NOT NULL,
	"source_url" text NOT NULL,
	"title" text,
	"body_text" text NOT NULL,
	"author_display_name" text,
	"author_external_id" text,
	"posted_at" timestamp with time zone,
	"first_collected_at" timestamp with time zone NOT NULL,
	"last_collected_at" timestamp with time zone NOT NULL,
	"reaction_count" integer NOT NULL,
	"comment_count" integer NOT NULL,
	"share_count" integer,
	"top_comments" jsonb NOT NULL,
	"status" "content_status" NOT NULL,
	"raw_payload_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" "content_platform" NOT NULL,
	"external_group_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"category_id" text NOT NULL,
	"status" "source_group_status" NOT NULL,
	"collection_priority" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_source_group_id_source_groups_id_fk" FOREIGN KEY ("source_group_id") REFERENCES "public"."source_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_groups" ADD CONSTRAINT "source_groups_category_id_content_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."content_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_categories_slug_uidx" ON "content_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "content_items_platform_external_post_id_uidx" ON "content_items" USING btree ("platform","external_post_id");--> statement-breakpoint
CREATE INDEX "content_items_source_group_id_idx" ON "content_items" USING btree ("source_group_id");--> statement-breakpoint
CREATE INDEX "content_items_status_idx" ON "content_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_items_last_collected_at_idx" ON "content_items" USING btree ("last_collected_at");--> statement-breakpoint
CREATE INDEX "content_items_reaction_count_idx" ON "content_items" USING btree ("reaction_count");--> statement-breakpoint
CREATE INDEX "content_items_comment_count_idx" ON "content_items" USING btree ("comment_count");--> statement-breakpoint
CREATE UNIQUE INDEX "source_groups_platform_external_group_id_uidx" ON "source_groups" USING btree ("platform","external_group_id");--> statement-breakpoint
CREATE INDEX "source_groups_platform_idx" ON "source_groups" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "source_groups_status_idx" ON "source_groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_groups_category_id_idx" ON "source_groups" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "source_groups_collection_priority_idx" ON "source_groups" USING btree ("collection_priority");