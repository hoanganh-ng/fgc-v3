import { asc, desc, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  SourceGroupEntryRoute,
  TopComment,
} from "../../../content-manager/domain";

export const contentPlatformEnum = pgEnum("content_platform", ["FACEBOOK"]);

export const sourceGroupStatusEnum = pgEnum("source_group_status", [
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
]);

export const contentStatusEnum = pgEnum("content_status", [
  "COLLECTED",
  "SELECTED",
  "REJECTED",
  "USED",
]);

export const sourcePublisherKindEnum = pgEnum("source_publisher_kind", [
  "GROUP",
  "PAGE",
]);

export const sourcePublisherStatusEnum = pgEnum("source_publisher_status", [
  "DISCOVERED",
  "APPROVED",
  "IGNORED",
  "BLOCKED",
]);

const timestampWithTimezone = (name: string) =>
  timestamp(name, { mode: "string", withTimezone: true });

export const contentCategories = pgTable(
  "content_categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_categories_slug_uidx").on(table.slug),
  ],
);

export const sourceGroups = pgTable(
  "source_groups",
  {
    id: text("id").primaryKey(),
    platform: contentPlatformEnum("platform").notNull(),
    externalGroupId: text("external_group_id").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => contentCategories.id, { onDelete: "restrict" }),
    status: sourceGroupStatusEnum("status").notNull(),
    collectionPriority: integer("collection_priority").notNull(),
    notes: text("notes"),
    entryRoutes: jsonb("entry_routes")
      .$type<readonly SourceGroupEntryRoute[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("source_groups_platform_external_group_id_uidx").on(
      table.platform,
      table.externalGroupId,
    ),
    index("source_groups_platform_idx").on(table.platform),
    index("source_groups_status_idx").on(table.status),
    index("source_groups_category_id_idx").on(table.categoryId),
    index("source_groups_collection_priority_idx").on(table.collectionPriority),
  ],
);

export const contentItems = pgTable(
  "content_items",
  {
    id: text("id").primaryKey(),
    platform: contentPlatformEnum("platform").notNull(),
    sourceGroupId: text("source_group_id")
      .notNull()
      .references(() => sourceGroups.id, { onDelete: "restrict" }),
    externalPostId: text("external_post_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    title: text("title"),
    bodyText: text("body_text").notNull(),
    authorDisplayName: text("author_display_name"),
    authorExternalId: text("author_external_id"),
    postedAt: timestampWithTimezone("posted_at"),
    firstCollectedAt: timestampWithTimezone("first_collected_at").notNull(),
    lastCollectedAt: timestampWithTimezone("last_collected_at").notNull(),
    reactionCount: integer("reaction_count").notNull(),
    commentCount: integer("comment_count").notNull(),
    shareCount: integer("share_count"),
    topComments: jsonb("top_comments").$type<readonly TopComment[]>().notNull(),
    status: contentStatusEnum("status").notNull(),
    rawPayloadRef: text("raw_payload_ref"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_items_platform_external_post_id_uidx").on(
      table.platform,
      table.externalPostId,
    ),
    index("content_items_source_group_id_idx").on(table.sourceGroupId),
    index("content_items_status_idx").on(table.status),
    index("content_items_last_collected_at_idx").on(table.lastCollectedAt),
    index("content_items_reaction_count_idx").on(table.reactionCount),
    index("content_items_comment_count_idx").on(table.commentCount),
  ],
);

export const sourcePublishers = pgTable(
  "source_publishers",
  {
    id: text("id").primaryKey(),
    platform: contentPlatformEnum("platform").notNull(),
    kind: sourcePublisherKindEnum("kind").notNull(),
    externalPublisherId: text("external_publisher_id").notNull(),
    displayName: text("display_name"),
    canonicalUrl: text("canonical_url"),
    status: sourcePublisherStatusEnum("status").notNull(),
    firstObservedAt: timestampWithTimezone("first_observed_at").notNull(),
    lastObservedAt: timestampWithTimezone("last_observed_at").notNull(),
    observationCount: integer("observation_count").notNull(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("source_publishers_identity_uidx").on(
      table.platform,
      table.kind,
      table.externalPublisherId,
    ),
    index("source_publishers_status_idx").on(table.status),
    index("source_publishers_kind_idx").on(table.kind),
    index("source_publishers_platform_idx").on(table.platform),
    index("source_publishers_last_observed_at_id_idx").on(
      desc(table.lastObservedAt),
      asc(table.id),
    ),
    check(
      "source_publishers_observation_count_check",
      sql`${table.observationCount} >= 1`,
    ),
    check(
      "source_publishers_first_le_last_observed_at_check",
      sql`${table.firstObservedAt} <= ${table.lastObservedAt}`,
    ),
  ],
);
