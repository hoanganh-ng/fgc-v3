# Content Manager Storage Notes

## Purpose

This document records Content Manager storage direction. Sprint 017 implements the first PostgreSQL/Drizzle storage shape for Content Manager tables, repositories, mappers, migrations, and gated database integration tests.

Content Manager domain and application code must continue to depend only on domain objects and application-owned ports as implementation continues.

Content Manager storage must be designed around normalized Content Manager ingestion input. Raw Facebook GraphQL payload interpretation belongs to the Collector Runtime / Platform Extractor boundary, not Content Manager persistence or domain logic.

## Implemented Tables

PostgreSQL storage includes:

- `source_groups`
- `content_categories`
- `content_items`

## V1 Storage Direction

Implemented v1 direction:

- Keep operational and query fields as PostgreSQL root columns.
- Store top comments as JSONB at first unless individual comment querying becomes necessary.
- Store `raw_payload_ref` as an optional reference field only. Do not store raw Facebook GraphQL payloads as canonical content data.
- Keep deduplication enforced by a unique constraint on platform plus external post id.
- Reconstruct and validate domain/application data before it reaches use cases.

## Source Groups

Table: `source_groups`

Root-level columns:

- `id`: primary key.
- `platform`: first value is `FACEBOOK`.
- `external_group_id`: external Facebook group identifier.
- `name`: source group display name.
- `url`: source group URL.
- `category_id`: reference to `content_categories.id`.
- `status`: `ACTIVE`, `PAUSED`, or `ARCHIVED`.
- `collection_priority`: future scheduling and collection priority signal.
- `notes`: optional operational notes.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

## Content Categories

Table: `content_categories`

Root-level columns:

- `id`: primary key.
- `name`: category display name.
- `slug`: stable category slug.
- `description`: nullable description.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

## Content Items

Table: `content_items`

Root-level columns:

- `id`: primary key.
- `platform`: first value is `FACEBOOK`.
- `source_group_id`: reference to `source_groups.id`.
- `external_post_id`: external Facebook post identifier.
- `source_url`: source post URL.
- `title`: nullable title.
- `body_text`: post body text.
- `author_display_name`: nullable author display name.
- `author_external_id`: nullable external author identifier.
- `posted_at`: nullable source posted timestamp.
- `first_collected_at`: first time this content was collected.
- `last_collected_at`: latest time this content was collected.
- `reaction_count`: latest reaction count.
- `comment_count`: latest comment count.
- `share_count`: nullable latest share count.
- `raw_payload_ref`: nullable external reference to raw payload storage.
- `status`: `COLLECTED`, `SELECTED`, `REJECTED`, or `USED`.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

JSONB columns:

- `top_comments`: latest top N high-engagement comments.

Optional future diagnostics columns, if explicitly introduced by a later sprint:

- `sanitized_raw_payload`: sanitized source payload data for trusted diagnostics or future reprocessing.

Diagnostics columns are optional. They must not be required by Content Manager domain rules and must not become the primary ingestion contract. `raw_payload_ref` is currently available only as an optional external reference, not as embedded raw payload storage.

## Top Comments

V1 can store top comments as JSONB on `content_items`.

Use a separate `content_item_top_comments` table later if the product needs:

- Individual comment querying.
- Comment-level moderation or lifecycle status.
- Comment-level deduplication across collection runs.
- Comment-level indexing by author, reaction count, or posted timestamp.

If a future table is introduced, likely root-level fields are:

- `content_item_id`
- `external_comment_id`
- `body_text`
- `author_display_name`
- `author_external_id`
- `reaction_count`
- `reply_count`
- `posted_at`
- `collected_at`

## Implemented Indexes

- Unique index on `content_items(platform, external_post_id)`.
- Index on `content_items(source_group_id)`.
- Index on `content_items(status)`.
- Index on `content_items(last_collected_at)`.
- Index on `content_items(reaction_count)`.
- Index on `content_items(comment_count)`.
- Index on `source_groups(category_id)` for category filtering.
- Index on `source_groups(status)` for future collection eligibility.
- Unique index on `content_categories(slug)`.

## Notes

The implemented shape keeps frequently filtered operational fields in columns while allowing nested top comment payloads to begin as JSONB. This matches the current project direction of using PostgreSQL root columns for query-critical fields and JSONB for complex structures that are usually loaded as a whole. Raw platform payload parsing remains outside Content Manager.
