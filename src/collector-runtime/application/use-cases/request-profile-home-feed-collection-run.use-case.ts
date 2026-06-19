import {
  ProfileHomeFeedCollectionRunValidationError,
  ProfileNotFoundError,
  ProfileReferenceLookupFailedError,
} from "../application-errors";
import {
  toProfileHomeFeedCollectionRunIsoDateTime,
  validateProfileHomeFeedCollectionRunForApplication,
  validateProfileHomeFeedCollectionRunParametersForApplication,
} from "../profile-home-feed-collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { ProfileHomeFeedCollectionRunRepository } from "../ports/profile-home-feed-collection-run-repository.port";
import type {
  ProfileReferencePort,
  ProfileReferenceResult,
} from "../ports/profile-reference.port";
import type {
  CollectorRuntimeAccountStage,
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunParameters,
  ValidationIssue,
} from "../../domain";

export interface RequestProfileHomeFeedCollectionRunInput {
  readonly profileId: string;
  readonly maxScrolls?: number;
  readonly maxDurationMs?: number;
  readonly maxPosts?: number;
}

export class RequestProfileHomeFeedCollectionRunUseCase {
  public constructor(
    private readonly runs: ProfileHomeFeedCollectionRunRepository,
    private readonly profiles: ProfileReferencePort,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: RequestProfileHomeFeedCollectionRunInput,
  ): Promise<ProfileHomeFeedCollectionRun> {
    const profileId = validateProfileId(input.profileId);
    const parameters =
      validateProfileHomeFeedCollectionRunParametersForApplication(
        toParameters(input),
      );
    const accountStageAtRequest = await this.resolveProfileStage(profileId);
    const now = toProfileHomeFeedCollectionRunIsoDateTime(this.clock.now());

    const run = validateProfileHomeFeedCollectionRunForApplication({
      id: await this.ids.generateId(),
      profileId,
      triggerType: "MANUAL_API",
      status: "QUEUED",
      accountStageAtRequest,
      target: {
        platform: "FACEBOOK",
        surface: "PROFILE_HOME_FEED",
      },
      parameters,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await this.runs.save(run);

    return run;
  }

  private async resolveProfileStage(
    profileId: string,
  ): Promise<CollectorRuntimeAccountStage> {
    let result: ProfileReferenceResult;
    try {
      result = await this.profiles.getProfileAccountStage(profileId);
    } catch {
      throw new ProfileReferenceLookupFailedError(
        profileId,
        "Could not safely look up profile.",
      );
    }

    if (!result.ok) {
      if (
        result.errorCode === "PROFILE_NOT_FOUND" ||
        result.statusCode === 404
      ) {
        throw new ProfileNotFoundError(profileId);
      }

      throw new ProfileReferenceLookupFailedError(
        profileId,
        "Profile Manager returned an error.",
        {
          causeCode: result.errorCode,
          ...(result.statusCode !== undefined
            ? { statusCode: result.statusCode }
            : {}),
        },
      );
    }

    if (result.profileId !== profileId) {
      throw new ProfileReferenceLookupFailedError(
        profileId,
        "Profile Manager returned a mismatched profile ID.",
      );
    }

    return result.accountStage;
  }
}

function toParameters(
  input: RequestProfileHomeFeedCollectionRunInput,
): ProfileHomeFeedCollectionRunParameters {
  return {
    ...(input.maxScrolls !== undefined ? { maxScrolls: input.maxScrolls } : {}),
    ...(input.maxDurationMs !== undefined
      ? { maxDurationMs: input.maxDurationMs }
      : {}),
    ...(input.maxPosts !== undefined ? { maxPosts: input.maxPosts } : {}),
  };
}

function validateProfileId(profileId: string): string {
  const issues: ValidationIssue[] = [];

  if (typeof profileId !== "string" || profileId.trim().length === 0) {
    issues.push({
      path: "profileId",
      message: "profileId must be a non-empty string.",
    });
  }

  if (issues.length > 0) {
    throw new ProfileHomeFeedCollectionRunValidationError(issues);
  }

  return profileId;
}
