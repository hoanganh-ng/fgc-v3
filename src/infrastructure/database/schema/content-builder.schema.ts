import { asc, sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const transformTypeStatusEnum = pgEnum("transform_type_status", [
  "ACTIVE",
  "ARCHIVED",
]);

const timestampWithTimezone = (name: string) =>
  timestamp(name, { mode: "string", withTimezone: true });

export const contentBuilderTransformTypes = pgTable(
  "content_builder_transform_types",
  {
    transformTypeId: text("transform_type_id").primaryKey(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    description: text("description"),
    initialPrompt: text("initial_prompt").notNull(),
    status: transformTypeStatusEnum("status").notNull(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_builder_transform_types_active_name_uidx")
      .on(table.normalizedName)
      .where(sql`${table.status} <> 'ARCHIVED'`),
    index("content_builder_transform_types_status_idx").on(table.status),
    index("content_builder_transform_types_created_at_idx").on(
      asc(table.createdAt),
      asc(table.transformTypeId),
    ),
  ],
);
