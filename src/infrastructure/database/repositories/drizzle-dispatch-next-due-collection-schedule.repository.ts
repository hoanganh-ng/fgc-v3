import { sql } from "drizzle-orm";
import type {
  DispatchNextDueCollectionScheduleInput,
  DispatchNextDueCollectionScheduleRepositoryPort,
  DispatchNextDueCollectionScheduleResult,
} from "../../../collector-runtime/application";
import { nextDispatchBoundary } from "../../../collector-runtime/domain/collection-schedule-cadence";
import type {
  CollectionRun,
  CollectionSchedule,
} from "../../../collector-runtime/domain";
import type { Database } from "../client";
import type { DatabaseTransaction } from "../client";
import {
  type CollectionRunRow,
  type CollectionScheduleRow,
  toCollectionRunDomain,
  toCollectionScheduleDomain,
} from "../mappers/collector-runtime.mapper";

export class DrizzleDispatchNextDueCollectionScheduleRepository
  implements DispatchNextDueCollectionScheduleRepositoryPort
{
  public constructor(private readonly database: Database) {}

  public async dispatchNextDue(
    input: DispatchNextDueCollectionScheduleInput,
  ): Promise<DispatchNextDueCollectionScheduleResult | null> {
    return this.database.transaction(async (tx) =>
      dispatchWithinTransaction(tx, input),
    );
  }
}

async function dispatchWithinTransaction(
  tx: DatabaseTransaction,
  input: DispatchNextDueCollectionScheduleInput,
): Promise<DispatchNextDueCollectionScheduleResult | null> {
  const selected = await tx.execute<CollectionScheduleRow>(sql`
    SELECT
      source_group_id AS "sourceGroupId",
      enabled AS "enabled",
      interval_minutes AS "intervalMinutes",
      parameters AS "parameters",
      next_run_at AS "nextRunAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM collector_collection_schedules
    WHERE enabled = true AND next_run_at <= ${input.dispatchAt}
    ORDER BY next_run_at ASC, source_group_id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  `);

  const [scheduleRow] = selected.rows;

  if (scheduleRow === undefined) {
    return null;
  }

  const schedule = toCollectionScheduleDomain(scheduleRow);

  const nextNextRunAt = nextDispatchBoundary(
    schedule.nextRunAt,
    schedule.intervalMinutes,
    input.dispatchAt,
  );

  await tx.execute(sql`
    INSERT INTO collector_collection_runs (
      id,
      source_group_id,
      status,
      trigger_type,
      parameters,
      requested_at,
      created_at,
      updated_at
    ) VALUES (
      ${input.collectionRunId},
      ${schedule.sourceGroupId},
      'QUEUED',
      'SCHEDULED',
      ${JSON.stringify(schedule.parameters)}::jsonb,
      ${schedule.nextRunAt},
      ${input.dispatchAt},
      ${input.dispatchAt}
    )
  `);

  const updated = await tx.execute<CollectionScheduleRow>(sql`
    UPDATE collector_collection_schedules
    SET next_run_at = ${nextNextRunAt}, updated_at = ${input.dispatchAt}
    WHERE source_group_id = ${schedule.sourceGroupId}
    RETURNING
      source_group_id AS "sourceGroupId",
      enabled AS "enabled",
      interval_minutes AS "intervalMinutes",
      parameters AS "parameters",
      next_run_at AS "nextRunAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `);

  const [updatedRow] = updated.rows;

  if (updatedRow === undefined) {
    throw new Error(
      `Schedule row vanished during dispatch: ${schedule.sourceGroupId}.`,
    );
  }

  const collectionRunRow: CollectionRunRow = {
    id: input.collectionRunId,
    sourceGroupId: schedule.sourceGroupId,
    status: "QUEUED",
    triggerType: "SCHEDULED",
    parameters: schedule.parameters,
    summary: null,
    failureReason: null,
    requestedAt: schedule.nextRunAt,
    startedAt: null,
    finishedAt: null,
    createdAt: input.dispatchAt,
    updatedAt: input.dispatchAt,
  };

  const advancedSchedule: CollectionSchedule = toCollectionScheduleDomain(
    updatedRow,
  );
  const collectionRun: CollectionRun = toCollectionRunDomain(collectionRunRow);

  return {
    schedule: advancedSchedule,
    collectionRun,
  };
}