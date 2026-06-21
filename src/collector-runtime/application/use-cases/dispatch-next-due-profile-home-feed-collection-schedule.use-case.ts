import {
  toProfileHomeFeedCollectionScheduleIsoDateTime,
  validateProfileHomeFeedCollectionScheduleForApplication,
} from "../profile-home-feed-collection-schedule-validation";
import { validateProfileHomeFeedCollectionRunForApplication } from "../profile-home-feed-collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type {
  DispatchNextDueProfileHomeFeedCollectionScheduleRepositoryPort,
  DispatchProfileHomeFeedCollectionScheduleResult,
} from "../ports/dispatch-next-due-profile-home-feed-collection-schedule-repository.port";
import type {
  ProfileReferencePort,
  ProfileReferenceResult,
} from "../ports/profile-reference.port";
import type {
  CollectorRuntimeAccountStage,
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunId,
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleFailureReason,
  ProfileHomeFeedCollectionScheduleIsoDateTime,
} from "../../domain";

export type DispatchNextDueProfileHomeFeedCollectionScheduleUseCaseResult =
  | {
      readonly outcome: "NO_DUE_SCHEDULE";
    }
  | {
      readonly outcome: "DISPATCHED";
      readonly schedule: ProfileHomeFeedCollectionSchedule;
      readonly run: ProfileHomeFeedCollectionRun;
    }
  | {
      readonly outcome: "SKIPPED_ACTIVE_RUN";
      readonly schedule: ProfileHomeFeedCollectionSchedule;
    }
  | {
      readonly outcome: "PROFILE_NOT_FOUND";
      readonly schedule: ProfileHomeFeedCollectionSchedule;
    }
  | {
      readonly outcome: "PROFILE_LOOKUP_FAILED";
      readonly schedule: ProfileHomeFeedCollectionSchedule;
    }
  | {
      readonly outcome: "RACE_LOST";
    };

export class DispatchNextDueProfileHomeFeedCollectionScheduleUseCase {
  public constructor(
    private readonly dispatcher:
      DispatchNextDueProfileHomeFeedCollectionScheduleRepositoryPort,
    private readonly profiles: ProfileReferencePort,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  public async execute(): Promise<DispatchNextDueProfileHomeFeedCollectionScheduleUseCaseResult> {
    const dispatchAt = toProfileHomeFeedCollectionScheduleIsoDateTime(
      this.clock.now(),
    );
    const candidate = await this.dispatcher.findNextDueCandidate(dispatchAt);

    if (candidate === null) {
      return { outcome: "NO_DUE_SCHEDULE" };
    }

    const schedule = validateProfileHomeFeedCollectionScheduleForApplication(
      candidate.schedule,
    );
    const expectedNextRunAt = schedule.nextRunAt;
    const profileResult = await this.lookupProfile(schedule.profileId);

    if (!profileResult.ok) {
      if (profileResult.reason === "not_found") {
        const result = await this.dispatcher.recordProfileNotFound({
          profileId: schedule.profileId,
          expectedNextRunAt,
          dispatchAt,
        });

        return result.outcome === "RACE_LOST"
          ? { outcome: "RACE_LOST" }
          : {
              outcome: "PROFILE_NOT_FOUND",
              schedule: validateProfileHomeFeedCollectionScheduleForApplication(
                result.schedule,
              ),
            };
      }

      const result = await this.dispatcher.recordProfileLookupFailed({
        profileId: schedule.profileId,
        expectedNextRunAt,
        dispatchAt,
        failureReason: profileResult.failureReason,
      });

      return result.outcome === "RACE_LOST"
        ? { outcome: "RACE_LOST" }
        : {
            outcome: "PROFILE_LOOKUP_FAILED",
            schedule: validateProfileHomeFeedCollectionScheduleForApplication(
              result.schedule,
            ),
          };
    }

    const dispatchResult = await this.dispatcher.dispatchOrSkipActiveRun({
      profileId: schedule.profileId,
      expectedNextRunAt,
      dispatchAt,
      runId: (await this.idGenerator.generateId()) as ProfileHomeFeedCollectionRunId,
      accountStageAtRequest: profileResult.accountStage,
    });

    return toUseCaseDispatchResult(dispatchResult);
  }

  private async lookupProfile(
    profileId: string,
  ): Promise<
    | {
        readonly ok: true;
        readonly accountStage: CollectorRuntimeAccountStage;
      }
    | {
        readonly ok: false;
        readonly reason: "not_found" | "lookup_failed";
        readonly failureReason: ProfileHomeFeedCollectionScheduleFailureReason;
      }
  > {
    let result: ProfileReferenceResult;

    try {
      result = await this.profiles.getProfileAccountStage(profileId);
    } catch {
      return {
        ok: false,
        reason: "lookup_failed",
        failureReason: {
          code: "PROFILE_REFERENCE_LOOKUP_FAILED",
          message: "Could not safely look up profile.",
        },
      };
    }

    if (!result.ok) {
      if (
        result.errorCode === "PROFILE_NOT_FOUND" ||
        result.statusCode === 404
      ) {
        return {
          ok: false,
          reason: "not_found",
          failureReason: {
            code: "PROFILE_NOT_FOUND",
            message: "Profile was not found.",
          },
        };
      }

      return {
        ok: false,
        reason: "lookup_failed",
        failureReason: {
          code: "PROFILE_REFERENCE_LOOKUP_FAILED",
          message: "Profile Manager returned an error.",
        },
      };
    }

    if (result.profileId !== profileId) {
      return {
        ok: false,
        reason: "lookup_failed",
        failureReason: {
          code: "PROFILE_REFERENCE_LOOKUP_FAILED",
          message: "Profile Manager returned a mismatched profile ID.",
        },
      };
    }

    return {
      ok: true,
      accountStage: result.accountStage,
    };
  }
}

function toUseCaseDispatchResult(
  result: DispatchProfileHomeFeedCollectionScheduleResult,
): DispatchNextDueProfileHomeFeedCollectionScheduleUseCaseResult {
  if (result.outcome === "RACE_LOST") {
    return { outcome: "RACE_LOST" };
  }

  if (result.outcome === "SKIPPED_ACTIVE_RUN") {
    return {
      outcome: "SKIPPED_ACTIVE_RUN",
      schedule: validateProfileHomeFeedCollectionScheduleForApplication(
        result.schedule,
      ),
    };
  }

  return {
    outcome: "DISPATCHED",
    schedule: validateProfileHomeFeedCollectionScheduleForApplication(
      result.schedule,
    ),
    run: validateProfileHomeFeedCollectionRunForApplication(result.run),
  };
}
