import type {
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleProfileId,
} from "../../domain";
import type {
  ProfileHomeFeedCollectionScheduleListQuery,
  ProfileHomeFeedCollectionScheduleListResult,
  ProfileHomeFeedCollectionScheduleRepository,
} from "../ports/profile-home-feed-collection-schedule-repository.port";

export class InMemoryProfileHomeFeedCollectionScheduleRepository
  implements ProfileHomeFeedCollectionScheduleRepository
{
  private readonly schedules = new Map<
    ProfileHomeFeedCollectionScheduleProfileId,
    ProfileHomeFeedCollectionSchedule
  >();

  public async save(
    schedule: ProfileHomeFeedCollectionSchedule,
  ): Promise<void> {
    this.schedules.set(schedule.profileId, { ...schedule });
  }

  public async findByProfileId(
    profileId: ProfileHomeFeedCollectionScheduleProfileId,
  ): Promise<ProfileHomeFeedCollectionSchedule | null> {
    return this.schedules.get(profileId) ?? null;
  }

  public async list(
    query: ProfileHomeFeedCollectionScheduleListQuery,
  ): Promise<ProfileHomeFeedCollectionScheduleListResult> {
    const matchingSchedules = [...this.schedules.values()]
      .filter(
        (schedule) =>
          query.enabled === undefined || schedule.enabled === query.enabled,
      )
      .sort(compareSchedulesByNextRunAtThenProfileId);

    return {
      items: matchingSchedules.slice(query.offset, query.offset + query.limit),
      total: matchingSchedules.length,
    };
  }
}

function compareSchedulesByNextRunAtThenProfileId(
  left: ProfileHomeFeedCollectionSchedule,
  right: ProfileHomeFeedCollectionSchedule,
): number {
  const nextRunAtComparison =
    Date.parse(left.nextRunAt) - Date.parse(right.nextRunAt);

  if (nextRunAtComparison !== 0) {
    return nextRunAtComparison;
  }

  return left.profileId.localeCompare(right.profileId);
}
