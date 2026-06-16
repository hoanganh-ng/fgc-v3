import {
  ProfileNotFoundError,
  ProfileReferenceLookupFailedError,
  ProfileSourceAccessCheckRunConflictError,
  ProfileSourceAccessCheckRunSourceGroupNotActiveError,
  ProfileSourceAccessCheckRunSourceGroupNotFoundError,
  ProfileSourceAccessCheckRunSourceGroupPlatformUnsupportedError,
  SourceGroupLookupFailedError,
} from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { ProfileReferencePort } from "../ports/profile-reference.port";
import type { ProfileSourceAccessCheckRunRepository } from "../ports/profile-source-access-check-run-repository.port";
import type {
  SourceGroupLookupPort,
  SourceGroupLookupResult,
  SourceGroupLookupSourceGroup,
} from "../ports/source-group-lookup.port";
import { toProfileSourceAccessCheckRunIsoDateTime, validateProfileSourceAccessCheckRunForApplication } from "../profile-source-access-check-run-validation";
import { canonicalizeFacebookUrl } from "../../domain";
import type { CollectorRuntimeAccountStage, ProfileSourceAccessCheckRun } from "../../domain";

export interface RequestProfileSourceAccessCheckRunInput {
  readonly profileId: string;
  readonly sourceGroupId: string;
}

export class RequestProfileSourceAccessCheckRunUseCase {
  public constructor(
    private readonly checkRuns: ProfileSourceAccessCheckRunRepository,
    private readonly profiles: ProfileReferencePort,
    private readonly sourceGroups: SourceGroupLookupPort,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: RequestProfileSourceAccessCheckRunInput,
  ): Promise<ProfileSourceAccessCheckRun> {
    const activeRuns = await this.checkRuns.findByProfileAndSourceGroup(
      input.profileId,
      input.sourceGroupId,
    );

    const hasActiveRun = activeRuns.some(
      (run) => run.status === "QUEUED" || run.status === "RUNNING",
    );

    if (hasActiveRun) {
      throw new ProfileSourceAccessCheckRunConflictError(
        input.profileId,
        input.sourceGroupId,
      );
    }

    const accountStage = await this.resolveProfileStage(input.profileId);
    const sourceGroup = await this.resolveSourceGroup(input.sourceGroupId);

    const canonicalSourceUrl = canonicalizeFacebookUrl(sourceGroup.url);
    if (canonicalSourceUrl === undefined) {
      throw new SourceGroupLookupFailedError(
        input.sourceGroupId,
        "Source group URL is not a valid credential-free HTTPS Facebook URL.",
      );
    }

    const now = toProfileSourceAccessCheckRunIsoDateTime(this.clock.now());

    const checkRun = validateProfileSourceAccessCheckRunForApplication({
      id: await this.ids.generateId(),
      profileId: input.profileId,
      sourceGroupId: input.sourceGroupId,
      triggerType: "MANUAL",
      status: "QUEUED",
      accountStageAtRequest: accountStage,
      target: {
        platform: "FACEBOOK",
        routeType: "DIRECT_GROUP_URL",
        url: sourceGroup.url,
      },
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await this.checkRuns.save(checkRun);

    return checkRun;
  }

  private async resolveProfileStage(profileId: string): Promise<CollectorRuntimeAccountStage> {
    let result;
    try {
      result = await this.profiles.getProfileAccountStage(profileId);
    } catch (error) {
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
      throw new ProfileReferenceLookupFailedError(profileId, "Profile Manager returned an error.", {
        causeCode: result.errorCode,
        ...(result.statusCode !== undefined ? { statusCode: result.statusCode } : {}),
      });
    }

    if (result.profileId !== profileId) {
      throw new ProfileReferenceLookupFailedError(profileId, "Profile Manager returned a mismatched profile ID.");
    }

    return result.accountStage;
  }

  private async resolveSourceGroup(
    sourceGroupId: string,
  ): Promise<SourceGroupLookupSourceGroup> {
    let result: SourceGroupLookupResult;
    try {
      result = await this.sourceGroups.getSourceGroup(sourceGroupId);
    } catch (error) {
      throw new SourceGroupLookupFailedError(
        sourceGroupId,
        "Could not safely look up source group.",
      );
    }

    if (!result.ok) {
      if (
        result.errorCode === "SOURCE_GROUP_NOT_FOUND" ||
        result.statusCode === 404
      ) {
        throw new ProfileSourceAccessCheckRunSourceGroupNotFoundError(sourceGroupId);
      }
      throw new SourceGroupLookupFailedError(sourceGroupId, "Content Manager returned an error.", {
        causeCode: result.errorCode,
        ...(result.statusCode !== undefined ? { statusCode: result.statusCode } : {}),
      });
    }

    const sourceGroup = result.sourceGroup;

    if (sourceGroup.id !== sourceGroupId) {
      throw new SourceGroupLookupFailedError(sourceGroupId, "Content Manager returned a mismatched source group ID.");
    }

    if (sourceGroup.platform !== "FACEBOOK") {
      throw new ProfileSourceAccessCheckRunSourceGroupPlatformUnsupportedError(
        sourceGroupId,
        sourceGroup.platform,
      );
    }

    if (sourceGroup.status !== "ACTIVE") {
      throw new ProfileSourceAccessCheckRunSourceGroupNotActiveError(
        sourceGroup.id,
      );
    }

    return sourceGroup;
  }
}
