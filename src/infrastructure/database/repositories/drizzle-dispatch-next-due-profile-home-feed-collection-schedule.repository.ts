import { sql } from "drizzle-orm";
import type {
  DispatchNextDueProfileHomeFeedCollectionScheduleCandidate,
  DispatchNextDueProfileHomeFeedCollectionScheduleRepositoryPort,
  DispatchProfileHomeFeedCollectionScheduleInput,
  DispatchProfileHomeFeedCollectionScheduleResult,
  ExpectedProfileHomeFeedCollectionScheduleInput,
  RecordProfileHomeFeedCollectionScheduleAttemptResult,
  RecordProfileHomeFeedCollectionScheduleLookupFailureInput,
} from "../../../collector-runtime/application";
import { nextDispatchBoundary } from "../../../collector-runtime/domain/collection-schedule-cadence";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionSchedule,
} from "../../../collector-runtime/domain";
import type { Database, DatabaseTransaction } from "../client";
import type { ProfileHomeFeedCollectionRunRow } from "../mappers/profile-home-feed-collection-run.mapper";
import { toDomainProfileHomeFeedCollectionRun } from "../mappers/profile-home-feed-collection-run.mapper";
import type { ProfileHomeFeedCollectionScheduleRow } from "../mappers/profile-home-feed-collection-schedule.mapper";
import { toDomainProfileHomeFeedCollectionSchedule } from "../mappers/profile-home-feed-collection-schedule.mapper";

export class DrizzleDispatchNextDueProfileHomeFeedCollectionScheduleRepository
  implements DispatchNextDueProfileHomeFeedCollectionScheduleRepositoryPort
{
  public constructor(private readonly database: Database) {}

  public async findNextDueCandidate(
    dispatchAt: string,
  ): Promise<DispatchNextDueProfileHomeFeedCollectionScheduleCandidate | null> {
    const selected = await this.database.execute<ProfileHomeFeedCollectionScheduleRow>(sql`
      SELECT ${scheduleSelectColumns}
      FROM collector_profile_home_feed_collection_schedules
      WHERE
        enabled = true
        AND next_run_at <= ${dispatchAt}
        AND (
          last_dispatch_status IS DISTINCT FROM 'PROFILE_LOOKUP_FAILED'
          OR last_attempted_at IS NULL
          OR last_attempted_at + make_interval(mins =>
            CASE
              WHEN consecutive_failures <= 1 THEN 1
              WHEN consecutive_failures = 2 THEN 2
              WHEN consecutive_failures = 3 THEN 4
              WHEN consecutive_failures = 4 THEN 8
              ELSE 15
            END
          ) <= ${dispatchAt}::timestamptz
        )
      ORDER BY next_run_at ASC, profile_id ASC
      LIMIT 1
    `);
    const [row] = selected.rows;

    return row === undefined
      ? null
      : { schedule: toDomainProfileHomeFeedCollectionSchedule(row) };
  }

  public async dispatchOrSkipActiveRun(
    input: DispatchProfileHomeFeedCollectionScheduleInput,
  ): Promise<DispatchProfileHomeFeedCollectionScheduleResult> {
    return this.database.transaction(async (tx) =>
      dispatchOrSkipActiveRunWithinTransaction(tx, input),
    );
  }

  public async recordProfileNotFound(
    input: ExpectedProfileHomeFeedCollectionScheduleInput,
  ): Promise<RecordProfileHomeFeedCollectionScheduleAttemptResult> {
    const updated = await this.database.execute<ProfileHomeFeedCollectionScheduleRow>(sql`
      UPDATE collector_profile_home_feed_collection_schedules
      SET
        enabled = false,
        last_attempted_at = ${input.dispatchAt},
        last_dispatch_status = 'PROFILE_NOT_FOUND',
        last_failure_reason = ${JSON.stringify({
          code: "PROFILE_NOT_FOUND",
          message: "Profile was not found.",
        })}::jsonb,
        consecutive_failures = consecutive_failures + 1,
        updated_at = ${input.dispatchAt}
      WHERE
        profile_id = ${input.profileId}
        AND enabled = true
        AND next_run_at = ${input.expectedNextRunAt}
        AND next_run_at <= ${input.dispatchAt}
      RETURNING ${scheduleSelectColumns}
    `);
    const [row] = updated.rows;

    return row === undefined
      ? { outcome: "RACE_LOST" }
      : {
          outcome: "UPDATED",
          schedule: toDomainProfileHomeFeedCollectionSchedule(row),
        };
  }

  public async recordProfileLookupFailed(
    input: RecordProfileHomeFeedCollectionScheduleLookupFailureInput,
  ): Promise<RecordProfileHomeFeedCollectionScheduleAttemptResult> {
    const updated = await this.database.execute<ProfileHomeFeedCollectionScheduleRow>(sql`
      UPDATE collector_profile_home_feed_collection_schedules
      SET
        last_attempted_at = ${input.dispatchAt},
        last_dispatch_status = 'PROFILE_LOOKUP_FAILED',
        last_failure_reason = ${JSON.stringify(input.failureReason)}::jsonb,
        consecutive_failures = consecutive_failures + 1,
        updated_at = ${input.dispatchAt}
      WHERE
        profile_id = ${input.profileId}
        AND enabled = true
        AND next_run_at = ${input.expectedNextRunAt}
        AND next_run_at <= ${input.dispatchAt}
      RETURNING ${scheduleSelectColumns}
    `);
    const [row] = updated.rows;

    return row === undefined
      ? { outcome: "RACE_LOST" }
      : {
          outcome: "UPDATED",
          schedule: toDomainProfileHomeFeedCollectionSchedule(row),
        };
  }
}

async function dispatchOrSkipActiveRunWithinTransaction(
  tx: DatabaseTransaction,
  input: DispatchProfileHomeFeedCollectionScheduleInput,
): Promise<DispatchProfileHomeFeedCollectionScheduleResult> {
  const selected = await tx.execute<ProfileHomeFeedCollectionScheduleRow>(sql`
    SELECT ${scheduleSelectColumns}
    FROM collector_profile_home_feed_collection_schedules
    WHERE
      profile_id = ${input.profileId}
      AND enabled = true
      AND next_run_at = ${input.expectedNextRunAt}
      AND next_run_at <= ${input.dispatchAt}
    FOR UPDATE
  `);
  const [scheduleRow] = selected.rows;

  if (scheduleRow === undefined) {
    return { outcome: "RACE_LOST" };
  }

  const schedule = toDomainProfileHomeFeedCollectionSchedule(scheduleRow);
  const nextRunAt = nextDispatchBoundary(
    schedule.nextRunAt,
    schedule.intervalMinutes,
    input.dispatchAt,
  );
  const activeRun = await tx.execute<{ readonly id: string }>(sql`
    SELECT id
    FROM profile_home_feed_collection_runs
    WHERE profile_id = ${input.profileId} AND status IN ('QUEUED', 'RUNNING')
    LIMIT 1
  `);

  if (activeRun.rows[0] !== undefined) {
    const skippedSchedule = await advanceSchedule(tx, {
      input,
      nextRunAt,
      lastDispatchStatus: "SKIPPED_ACTIVE_RUN",
    });

    return {
      outcome: "SKIPPED_ACTIVE_RUN",
      schedule: skippedSchedule,
    };
  }

  const inserted = await tx.execute<ProfileHomeFeedCollectionRunRow>(sql`
    INSERT INTO profile_home_feed_collection_runs (
      id,
      profile_id,
      trigger_type,
      status,
      account_stage_at_request,
      target,
      parameters,
      requested_at,
      created_at,
      updated_at
    ) VALUES (
      ${input.runId},
      ${schedule.profileId},
      'SCHEDULED',
      'QUEUED',
      ${input.accountStageAtRequest},
      ${JSON.stringify({
        platform: "FACEBOOK",
        surface: "PROFILE_HOME_FEED",
      })}::jsonb,
      ${JSON.stringify(schedule.parameters)}::jsonb,
      ${schedule.nextRunAt},
      ${input.dispatchAt},
      ${input.dispatchAt}
    )
    ON CONFLICT DO NOTHING
    RETURNING ${runSelectColumns}
  `);
  const [runRow] = inserted.rows;

  if (runRow === undefined) {
    const conflict = await tx.execute<{ readonly id: string }>(sql`
      SELECT id
      FROM profile_home_feed_collection_runs
      WHERE profile_id = ${input.profileId} AND status IN ('QUEUED', 'RUNNING')
      LIMIT 1
    `);

    if (conflict.rows[0] !== undefined) {
      const skippedSchedule = await advanceSchedule(tx, {
        input,
        nextRunAt,
        lastDispatchStatus: "SKIPPED_ACTIVE_RUN",
      });

      return {
        outcome: "SKIPPED_ACTIVE_RUN",
        schedule: skippedSchedule,
      };
    }

    throw new Error("Scheduled profile home-feed run insert conflicted.");
  }

  const advancedSchedule = await advanceSchedule(tx, {
    input,
    nextRunAt,
    lastDispatchStatus: "DISPATCHED",
  });

  return {
    outcome: "DISPATCHED",
    schedule: advancedSchedule,
    run: toDomainProfileHomeFeedCollectionRun(runRow),
  };
}

async function advanceSchedule(
  tx: DatabaseTransaction,
  options: {
    readonly input: DispatchProfileHomeFeedCollectionScheduleInput;
    readonly nextRunAt: string;
    readonly lastDispatchStatus: "DISPATCHED" | "SKIPPED_ACTIVE_RUN";
  },
): Promise<ProfileHomeFeedCollectionSchedule> {
  const updated = await tx.execute<ProfileHomeFeedCollectionScheduleRow>(sql`
    UPDATE collector_profile_home_feed_collection_schedules
    SET
      next_run_at = ${options.nextRunAt},
      last_attempted_at = ${options.input.dispatchAt},
      last_dispatch_status = ${options.lastDispatchStatus},
      last_failure_reason = NULL,
      consecutive_failures = 0,
      updated_at = ${options.input.dispatchAt}
    WHERE
      profile_id = ${options.input.profileId}
      AND enabled = true
      AND next_run_at = ${options.input.expectedNextRunAt}
    RETURNING ${scheduleSelectColumns}
  `);
  const [row] = updated.rows;

  if (row === undefined) {
    throw new Error(
      `Schedule row vanished during profile home-feed dispatch: ${options.input.profileId}.`,
    );
  }

  return toDomainProfileHomeFeedCollectionSchedule(row);
}

const scheduleSelectColumns = sql`
  profile_id AS "profileId",
  enabled AS "enabled",
  interval_minutes AS "intervalMinutes",
  next_run_at AS "nextRunAt",
  parameters AS "parameters",
  last_attempted_at AS "lastAttemptedAt",
  last_dispatch_status AS "lastDispatchStatus",
  last_failure_reason AS "lastFailureReason",
  consecutive_failures AS "consecutiveFailures",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const runSelectColumns = sql`
  id,
  profile_id AS "profileId",
  trigger_type AS "triggerType",
  status,
  account_stage_at_request AS "accountStageAtRequest",
  target,
  parameters,
  summary,
  failure_reason AS "failureReason",
  requested_at AS "requestedAt",
  started_at AS "startedAt",
  finished_at AS "finishedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;
