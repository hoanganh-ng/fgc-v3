import type {
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleProfileId,
} from "../../domain";
import type {
  ProfileHomeFeedCollectionScheduleListQuery,
  ProfileHomeFeedCollectionScheduleListResult,
  ProfileHomeFeedCollectionScheduleRepository,
} from "../ports/profile-home-feed-collection-schedule-repository.port";
import type {
  DispatchNextDueProfileHomeFeedCollectionScheduleCandidate,
  DispatchNextDueProfileHomeFeedCollectionScheduleRepositoryPort,
  DispatchProfileHomeFeedCollectionScheduleInput,
  DispatchProfileHomeFeedCollectionScheduleResult,
  ExpectedProfileHomeFeedCollectionScheduleInput,
  RecordProfileHomeFeedCollectionScheduleAttemptResult,
  RecordProfileHomeFeedCollectionScheduleLookupFailureInput,
} from "../ports/dispatch-next-due-profile-home-feed-collection-schedule-repository.port";
import { nextDispatchBoundary } from "../../domain/collection-schedule-cadence";
import type { ProfileHomeFeedCollectionRun } from "../../domain";

export class InMemoryProfileHomeFeedCollectionScheduleRepository
  implements
    ProfileHomeFeedCollectionScheduleRepository,
    DispatchNextDueProfileHomeFeedCollectionScheduleRepositoryPort
{
  private readonly schedules = new Map<
    ProfileHomeFeedCollectionScheduleProfileId,
    ProfileHomeFeedCollectionSchedule
  >();
  private readonly activeProfileIds = new Set<string>();
  private readonly runs = new Map<string, ProfileHomeFeedCollectionRun>();

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

  public seedActiveRun(profileId: string): void {
    this.activeProfileIds.add(profileId);
  }

  public getRun(runId: string): ProfileHomeFeedCollectionRun | undefined {
    return this.runs.get(runId);
  }

  public async findNextDueCandidate(
    dispatchAt: string,
  ): Promise<DispatchNextDueProfileHomeFeedCollectionScheduleCandidate | null> {
    const dispatchMs = Date.parse(dispatchAt);
    const schedule = [...this.schedules.values()]
      .filter((candidate) => candidate.enabled)
      .filter((candidate) => Date.parse(candidate.nextRunAt) <= dispatchMs)
      .filter((candidate) => !isInLookupBackoff(candidate, dispatchAt))
      .sort(compareSchedulesByNextRunAtThenProfileId)[0];

    return schedule === undefined ? null : { schedule: { ...schedule } };
  }

  public async dispatchOrSkipActiveRun(
    input: DispatchProfileHomeFeedCollectionScheduleInput,
  ): Promise<DispatchProfileHomeFeedCollectionScheduleResult> {
    const schedule = this.schedules.get(input.profileId);

    if (!isExpectedDueSchedule(schedule, input)) {
      return { outcome: "RACE_LOST" };
    }

    const nextRunAt = nextDispatchBoundary(
      schedule.nextRunAt,
      schedule.intervalMinutes,
      input.dispatchAt,
    );
    const advancedSchedule = {
      ...schedule,
      nextRunAt,
      lastAttemptedAt: input.dispatchAt,
      lastDispatchStatus: this.activeProfileIds.has(input.profileId)
        ? "SKIPPED_ACTIVE_RUN"
        : "DISPATCHED",
      lastFailureReason: undefined,
      consecutiveFailures: 0,
      updatedAt: input.dispatchAt,
    } satisfies ProfileHomeFeedCollectionSchedule;

    this.schedules.set(input.profileId, advancedSchedule);

    if (this.activeProfileIds.has(input.profileId)) {
      return {
        outcome: "SKIPPED_ACTIVE_RUN",
        schedule: advancedSchedule,
      };
    }

    const run: ProfileHomeFeedCollectionRun = {
      id: input.runId,
      profileId: schedule.profileId,
      triggerType: "SCHEDULED",
      status: "QUEUED",
      accountStageAtRequest: input.accountStageAtRequest,
      target: {
        platform: "FACEBOOK",
        surface: "PROFILE_HOME_FEED",
      },
      parameters: schedule.parameters,
      requestedAt: schedule.nextRunAt,
      createdAt: input.dispatchAt,
      updatedAt: input.dispatchAt,
    };

    this.runs.set(run.id, run);
    this.activeProfileIds.add(input.profileId);

    return {
      outcome: "DISPATCHED",
      schedule: advancedSchedule,
      run,
    };
  }

  public async recordProfileNotFound(
    input: ExpectedProfileHomeFeedCollectionScheduleInput,
  ): Promise<RecordProfileHomeFeedCollectionScheduleAttemptResult> {
    const schedule = this.schedules.get(input.profileId);

    if (!isExpectedDueSchedule(schedule, input)) {
      return { outcome: "RACE_LOST" };
    }

    const updatedSchedule = {
      ...schedule,
      enabled: false,
      lastAttemptedAt: input.dispatchAt,
      lastDispatchStatus: "PROFILE_NOT_FOUND",
      lastFailureReason: {
        code: "PROFILE_NOT_FOUND",
        message: "Profile was not found.",
      },
      consecutiveFailures: schedule.consecutiveFailures + 1,
      updatedAt: input.dispatchAt,
    } satisfies ProfileHomeFeedCollectionSchedule;
    this.schedules.set(input.profileId, updatedSchedule);

    return {
      outcome: "UPDATED",
      schedule: updatedSchedule,
    };
  }

  public async recordProfileLookupFailed(
    input: RecordProfileHomeFeedCollectionScheduleLookupFailureInput,
  ): Promise<RecordProfileHomeFeedCollectionScheduleAttemptResult> {
    const schedule = this.schedules.get(input.profileId);

    if (!isExpectedDueSchedule(schedule, input)) {
      return { outcome: "RACE_LOST" };
    }

    const updatedSchedule = {
      ...schedule,
      lastAttemptedAt: input.dispatchAt,
      lastDispatchStatus: "PROFILE_LOOKUP_FAILED",
      lastFailureReason: input.failureReason,
      consecutiveFailures: schedule.consecutiveFailures + 1,
      updatedAt: input.dispatchAt,
    } satisfies ProfileHomeFeedCollectionSchedule;
    this.schedules.set(input.profileId, updatedSchedule);

    return {
      outcome: "UPDATED",
      schedule: updatedSchedule,
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

function isExpectedDueSchedule(
  schedule: ProfileHomeFeedCollectionSchedule | undefined,
  input: ExpectedProfileHomeFeedCollectionScheduleInput,
): schedule is ProfileHomeFeedCollectionSchedule {
  return (
    schedule !== undefined &&
    schedule.enabled &&
    schedule.nextRunAt === input.expectedNextRunAt &&
    Date.parse(schedule.nextRunAt) <= Date.parse(input.dispatchAt)
  );
}

function isInLookupBackoff(
  schedule: ProfileHomeFeedCollectionSchedule,
  dispatchAt: string,
): boolean {
  if (
    schedule.lastDispatchStatus !== "PROFILE_LOOKUP_FAILED" ||
    schedule.lastAttemptedAt === undefined ||
    schedule.consecutiveFailures === 0
  ) {
    return false;
  }

  const backoffMs =
    lookupBackoffMinutes(schedule.consecutiveFailures) * 60_000;

  return Date.parse(schedule.lastAttemptedAt) + backoffMs > Date.parse(dispatchAt);
}

function lookupBackoffMinutes(consecutiveFailures: number): number {
  if (consecutiveFailures <= 1) {
    return 1;
  }

  if (consecutiveFailures === 2) {
    return 2;
  }

  if (consecutiveFailures === 3) {
    return 4;
  }

  if (consecutiveFailures === 4) {
    return 8;
  }

  return 15;
}
