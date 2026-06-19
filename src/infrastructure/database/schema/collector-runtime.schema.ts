import { sql } from "drizzle-orm";
import {
  boolean,
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
import {
  ACCOUNT_EXERCISE_RUN_STATUSES,
  ACCOUNT_EXERCISE_TYPES,
  COLLECTION_RUN_STATUSES,
  COLLECTION_RUN_TRIGGER_TYPES,
  PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES,
  PROFILE_HOME_FEED_COLLECTION_RUN_TRIGGER_TYPES,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_OUTCOMES,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUSES,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_TRIGGER_TYPES,
} from "../../../collector-runtime/domain";
import type {
  AccountExerciseRunActionBudget,
  AccountExerciseRunFailureReason,
  AccountExerciseRunSafeSummary,
  CategoryBrowseExerciseTarget,
  CollectionRunFailureReason,
  CollectionRunParameters,
  CollectionRunSummary,
  ProfileHomeFeedCollectionRunFailureReason,
  ProfileHomeFeedCollectionRunParameters,
  ProfileHomeFeedCollectionRunSummary,
  ProfileHomeFeedCollectionRunTarget,
  ProfileSourceAccessCheckRunTarget,
  ProfileSourceAccessCheckRunFailureReason,
  ProfileSourceAccessCheckRunOutcome,
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

export const profileSourceAccessCheckRunStatusEnum = pgEnum(
  "profile_source_access_check_run_status",
  PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUSES,
);

export const profileSourceAccessCheckRunTriggerTypeEnum = pgEnum(
  "profile_source_access_check_run_trigger_type",
  PROFILE_SOURCE_ACCESS_CHECK_RUN_TRIGGER_TYPES,
);

export const profileSourceAccessCheckRunOutcomeEnum = pgEnum(
  "profile_source_access_check_run_outcome",
  PROFILE_SOURCE_ACCESS_CHECK_RUN_OUTCOMES,
);

export const profileHomeFeedCollectionRunStatusEnum = pgEnum(
  "profile_home_feed_collection_run_status",
  PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES,
);

export const profileHomeFeedCollectionRunTriggerTypeEnum = pgEnum(
  "profile_home_feed_collection_run_trigger_type",
  PROFILE_HOME_FEED_COLLECTION_RUN_TRIGGER_TYPES,
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
    target: jsonb("target").$type<CategoryBrowseExerciseTarget>(),
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

export const collectorProfileSourceAccessCheckRuns = pgTable(
  "collector_profile_source_access_check_runs",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    sourceGroupId: text("source_group_id").notNull(),
    triggerType: profileSourceAccessCheckRunTriggerTypeEnum("trigger_type").notNull(),
    status: profileSourceAccessCheckRunStatusEnum("status").notNull(),
    accountStageAtRequest: text("account_stage_at_request").notNull(),
    target: jsonb("target").$type<ProfileSourceAccessCheckRunTarget>().notNull(),
    outcome: profileSourceAccessCheckRunOutcomeEnum("outcome").$type<ProfileSourceAccessCheckRunOutcome>(),
    failureReason:
      jsonb("failure_reason").$type<ProfileSourceAccessCheckRunFailureReason>(),
    requestedAt: timestampWithTimezone("requested_at").notNull(),
    startedAt: timestampWithTimezone("started_at"),
    finishedAt: timestampWithTimezone("finished_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("collector_psa_check_runs_status_idx").on(table.status),
    index("collector_psa_check_runs_profile_id_idx").on(table.profileId),
    index("collector_psa_check_runs_source_group_id_idx").on(table.sourceGroupId),
    index("collector_psa_check_runs_created_at_idx").on(table.createdAt),
    index("collector_psa_check_runs_requested_at_idx").on(table.requestedAt),
    uniqueIndex("collector_psa_check_runs_active_unique_idx")
      .on(table.profileId, table.sourceGroupId)
      .where(sql`status IN ('QUEUED', 'RUNNING')`),
  ],
);

export const profileHomeFeedCollectionRuns = pgTable(
  "profile_home_feed_collection_runs",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    triggerType: profileHomeFeedCollectionRunTriggerTypeEnum("trigger_type").notNull(),
    status: profileHomeFeedCollectionRunStatusEnum("status").notNull(),
    accountStageAtRequest: text("account_stage_at_request").notNull(),
    target: jsonb("target").$type<ProfileHomeFeedCollectionRunTarget>().notNull(),
    parameters:
      jsonb("parameters").$type<ProfileHomeFeedCollectionRunParameters>().notNull(),
    summary:
      jsonb("summary").$type<ProfileHomeFeedCollectionRunSummary>(),
    failureReason:
      jsonb("failure_reason").$type<ProfileHomeFeedCollectionRunFailureReason>(),
    requestedAt: timestampWithTimezone("requested_at").notNull(),
    startedAt: timestampWithTimezone("started_at"),
    finishedAt: timestampWithTimezone("finished_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("profile_home_feed_collection_runs_status_idx").on(table.status),
    index("profile_home_feed_collection_runs_profile_id_idx").on(
      table.profileId,
    ),
    index("profile_home_feed_collection_runs_created_at_idx").on(
      table.createdAt,
    ),
    index("profile_home_feed_collection_runs_requested_at_id_idx").on(
      table.requestedAt,
      table.id,
    ),
    uniqueIndex("profile_home_feed_collection_runs_active_profile_uidx")
      .on(table.profileId)
      .where(sql`status IN ('QUEUED', 'RUNNING')`),
  ],
);

export const collectorCollectionSchedules = pgTable(
  "collector_collection_schedules",
  {
    sourceGroupId: text("source_group_id").primaryKey(),
    enabled: boolean("enabled").notNull(),
    intervalMinutes: integer("interval_minutes").notNull(),
    nextRunAt: timestampWithTimezone("next_run_at").notNull(),
    parameters: jsonb("parameters").$type<CollectionRunParameters>().notNull(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "collector_collection_schedules_interval_minutes_check",
      sql`${table.intervalMinutes} BETWEEN 1 AND 10080`,
    ),
    index("collector_collection_schedules_due_idx").on(
      table.enabled,
      table.nextRunAt,
      table.sourceGroupId,
    ),
  ],
);
