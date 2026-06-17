import type {
  CollectionSchedule,
  CollectionScheduleSourceGroupId,
} from "../../domain";
import type {
  CollectionScheduleListQuery,
  CollectionScheduleListResult,
  CollectionScheduleRepository,
} from "../ports/collection-schedule-repository.port";

export class InMemoryCollectionScheduleRepository
  implements CollectionScheduleRepository
{
  private readonly schedules = new Map<
    CollectionScheduleSourceGroupId,
    CollectionSchedule
  >();

  public async save(schedule: CollectionSchedule): Promise<void> {
    this.schedules.set(schedule.sourceGroupId, { ...schedule });
  }

  public async findBySourceGroupId(
    sourceGroupId: CollectionScheduleSourceGroupId,
  ): Promise<CollectionSchedule | null> {
    return this.schedules.get(sourceGroupId) ?? null;
  }

  public async list(
    query: CollectionScheduleListQuery,
  ): Promise<CollectionScheduleListResult> {
    const matchingSchedules = [...this.schedules.values()].sort(
      compareCollectionSchedulesByNextRunAtThenSourceGroupId,
    );

    return {
      items: matchingSchedules.slice(query.offset, query.offset + query.limit),
      total: matchingSchedules.length,
    };
  }
}

function compareCollectionSchedulesByNextRunAtThenSourceGroupId(
  left: CollectionSchedule,
  right: CollectionSchedule,
): number {
  const nextRunAtComparison =
    Date.parse(left.nextRunAt) - Date.parse(right.nextRunAt);

  if (nextRunAtComparison !== 0) {
    return nextRunAtComparison;
  }

  return left.sourceGroupId.localeCompare(right.sourceGroupId);
}