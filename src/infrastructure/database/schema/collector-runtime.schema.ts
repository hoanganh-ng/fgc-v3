import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import {
  ACCOUNT_EXERCISE_RUN_STATUSES,
  ACCOUNT_EXERCISE_TYPES,
  COLLECTION_RUN_STATUSES,
  COLLECTION_RUN_TRIGGER_TYPES,
} from "../../../collector-runtime/domain";
import type {
  AccountExerciseRunActionBudget,
  AccountExerciseRunFailureReason,
  AccountExerciseRunSafeSummary,
  CollectionRunFailureReason,
  CollectionRunParameters,
  CollectionRunSummary,
} from "../../../collector-runtime/domain";

export const collectionRunStatusEnum = pgEnum(
  "collection_run_status",
  COLLECTION_RUN_STATUSES,
);

export const collectionRunTriggerTypeEnum = pgEnum(
  "collection_run_trigger_type",
  COLLECTION_RUN_TRIGGER_TYPES,
);

export const accountExerciseRunStatusEnum = pgEnum(
  "account_exercise_run_status",
  ACCOUNT_EXERCISE_RUN_STATUSES,
);

export const accountExerciseTypeEnum = pgEnum(
  "account_exercise_type",
  ACCOUNT_EXERCISE_TYPES,
);

const timestampWithTimezone = (name: string) =>
  timestamp(name, { mode: "string", withTimezone: true });

export const collectorCollectionRuns = pgTable(
  "collector_collection_runs",
  {
    id: text("id").primaryKey(),
    sourceGroupId: text("source_group_id").notNull(),
    status: collectionRunStatusEnum("status").notNull(),
    triggerType: collectionRunTriggerTypeEnum("trigger_type").notNull(),
    parameters: jsonb("parameters").$type<CollectionRunParameters>().notNull(),
    summary: jsonb("summary").$type<CollectionRunSummary>(),
    failureReason:
      jsonb("failure_reason").$type<CollectionRunFailureReason>(),
    requestedAt: timestampWithTimezone("requested_at").notNull(),
    startedAt: timestampWithTimezone("started_at"),
    finishedAt: timestampWithTimezone("finished_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("collector_collection_runs_status_idx").on(table.status),
    index("collector_collection_runs_source_group_id_idx").on(
      table.sourceGroupId,
    ),
    index("collector_collection_runs_created_at_idx").on(table.createdAt),
    index("collector_collection_runs_requested_at_idx").on(table.requestedAt),
  ],
);

export const collectorAccountExerciseRuns = pgTable(
  "collector_account_exercise_runs",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    leaseId: text("lease_id"),
    exerciseType: accountExerciseTypeEnum("exercise_type").notNull(),
    status: accountExerciseRunStatusEnum("status").notNull(),
    stageAtStart: text("stage_at_start").notNull(),
    actionBudget:
      jsonb("action_budget").$type<AccountExerciseRunActionBudget>().notNull(),
    safeSummary:
      jsonb("safe_summary").$type<AccountExerciseRunSafeSummary>(),
    failureReason:
      jsonb("failure_reason").$type<AccountExerciseRunFailureReason>(),
    requestedAt: timestampWithTimezone("requested_at").notNull(),
    startedAt: timestampWithTimezone("started_at"),
    finishedAt: timestampWithTimezone("finished_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("collector_account_exercise_runs_status_idx").on(table.status),
    index("collector_account_exercise_runs_profile_id_idx").on(table.profileId),
    index("collector_account_exercise_runs_created_at_idx").on(table.createdAt),
    index("collector_account_exercise_runs_requested_at_idx").on(
      table.requestedAt,
    ),
  ],
);
