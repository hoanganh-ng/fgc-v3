import { nextDispatchBoundary } from "../../domain/collection-schedule-cadence";
import type {
  CollectionRun,
  CollectionRunId,
  CollectionSchedule,
  CollectionScheduleIsoDateTime,
  CollectionScheduleSourceGroupId,
} from "../../domain";
import type {
  DispatchNextDueCollectionScheduleInput,
  DispatchNextDueCollectionScheduleRepositoryPort,
  DispatchNextDueCollectionScheduleResult,
} from "../ports/dispatch-next-due-collection-schedule-repository.port";

interface ScheduledRun {
  readonly collectionRun: CollectionRun;
  readonly advancedSchedule: CollectionSchedule;
}

export class InMemoryDispatchNextDueCollectionScheduleRepository
  implements DispatchNextDueCollectionScheduleRepositoryPort
{
  private readonly schedules = new Map<
    CollectionScheduleSourceGroupId,
    CollectionSchedule
  >();
  private readonly runs = new Map<CollectionRunId, CollectionRun>();
  private readonly invocations: DispatchNextDueCollectionScheduleInput[] = [];
  private forceErrorNextCall: Error | undefined;

  public async dispatchNextDue(
    input: DispatchNextDueCollectionScheduleInput,
  ): Promise<DispatchNextDueCollectionScheduleResult | null> {
    this.invocations.push(input);

    if (this.forceErrorNextCall !== undefined) {
      const error = this.forceErrorNextCall;
      this.forceErrorNextCall = undefined;
      throw error;
    }

    const candidate = pickDueSchedule(
      [...this.schedules.values()],
      input.dispatchAt,
    );

    if (candidate === undefined) {
      return null;
    }

    const nextNextRunAt = nextDispatchBoundary(
      candidate.schedule.nextRunAt,
      candidate.schedule.intervalMinutes,
      input.dispatchAt,
    );

    const advancedSchedule: CollectionSchedule = {
      ...candidate.schedule,
      nextRunAt: nextNextRunAt,
      updatedAt: input.dispatchAt,
    };

    const collectionRun: CollectionRun = {
      id: input.collectionRunId,
      sourceGroupId: candidate.schedule.sourceGroupId,
      status: "QUEUED",
      triggerType: "SCHEDULED",
      parameters: { ...candidate.schedule.parameters },
      requestedAt: candidate.schedule.nextRunAt,
      createdAt: input.dispatchAt,
      updatedAt: input.dispatchAt,
    };

    this.schedules.set(advancedSchedule.sourceGroupId, advancedSchedule);
    this.runs.set(collectionRun.id, collectionRun);

    const result: ScheduledRun = { collectionRun, advancedSchedule };

    return {
      schedule: result.advancedSchedule,
      collectionRun: result.collectionRun,
    };
  }

  public seedSchedule(schedule: CollectionSchedule): void {
    this.schedules.set(schedule.sourceGroupId, { ...schedule });
  }

  public setSchedule(schedule: CollectionSchedule): void {
    this.seedSchedule(schedule);
  }

  public setForceErrorNextCall(error: Error): void {
    this.forceErrorNextCall = error;
  }

  public getInvocations(): readonly DispatchNextDueCollectionScheduleInput[] {
    return [...this.invocations];
  }

  public getStoredSchedule(
    sourceGroupId: CollectionScheduleSourceGroupId,
  ): CollectionSchedule | undefined {
    const stored = this.schedules.get(sourceGroupId);
    return stored === undefined ? undefined : { ...stored };
  }

  public getStoredRun(id: CollectionRunId): CollectionRun | undefined {
    const stored = this.runs.get(id);
    return stored === undefined ? undefined : { ...stored };
  }

  public clear(): void {
    this.schedules.clear();
    this.runs.clear();
    this.invocations.length = 0;
    this.forceErrorNextCall = undefined;
  }
}

function pickDueSchedule(
  schedules: readonly CollectionSchedule[],
  dispatchAt: CollectionScheduleIsoDateTime,
): { readonly schedule: CollectionSchedule } | undefined {
  const dispatchMs = Date.parse(dispatchAt);
  const candidates = schedules
    .filter((schedule) => schedule.enabled)
    .filter((schedule) => Date.parse(schedule.nextRunAt) <= dispatchMs)
    .sort((left, right) => {
      const byNextRunAt =
        Date.parse(left.nextRunAt) - Date.parse(right.nextRunAt);

      if (byNextRunAt !== 0) {
        return byNextRunAt;
      }

      return left.sourceGroupId.localeCompare(right.sourceGroupId);
    });

  const [first] = candidates;

  return first === undefined ? undefined : { schedule: first };
}