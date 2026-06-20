import {
  InvalidProfileHomeFeedCollectionRunStatusTransitionError,
  ProfileHomeFeedCollectionRunNotFoundError,
} from "../application-errors";
import type {
  FacebookHomeFeedPayloadCapturePort,
  HomeFeedContentSubmissionInput,
  HomeFeedContentSubmissionPort,
  ProfileAuthenticationObservation,
  ProfileHomeFeedCheckoutPort,
  ProfileLeasePort,
  SourcePublisherObservationPort,
} from "../collector-runtime.ports";
import { loadValidatedProfileHomeFeedCollectionRunById } from "../profile-home-feed-collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { ProfileHomeFeedCollectionRunRepository } from "../ports/profile-home-feed-collection-run-repository.port";
import { MarkProfileHomeFeedCollectionRunFailedUseCase } from "./mark-profile-home-feed-collection-run-failed.use-case";
import { MarkProfileHomeFeedCollectionRunSucceededUseCase } from "./mark-profile-home-feed-collection-run-succeeded.use-case";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunFailureReason,
  ProfileHomeFeedCollectionRunId,
  ProfileHomeFeedCollectionRunSummary,
} from "../../domain";
import type {
  FacebookHomeFeedExtractedContentCandidate,
  FacebookHomeFeedGraphQLExtractionResult,
  FacebookHomeFeedGraphQLPayloadExtractionInput,
} from "../../platform-extractors/facebook";

export interface ExecuteProfileHomeFeedCollectionRunInput {
  readonly runId: ProfileHomeFeedCollectionRunId;
  readonly abortSignal?: AbortSignal;
}

export interface HomeFeedExtractorLike {
  extract(
    input: FacebookHomeFeedGraphQLPayloadExtractionInput,
  ): FacebookHomeFeedGraphQLExtractionResult;
}

export const HOME_FEED_EXECUTION_DEFAULT_MAX_SCROLLS = 3;
export const HOME_FEED_EXECUTION_DEFAULT_MAX_DURATION_MS = 30_000;
export const HOME_FEED_EXECUTION_DEFAULT_MAX_POSTS = 20;
export const HOME_FEED_EXECUTION_MAX_SCROLLS_CEILING = 10;
export const HOME_FEED_EXECUTION_MAX_DURATION_MS_CEILING = 120_000;
export const HOME_FEED_EXECUTION_MAX_POSTS_CEILING = 100;

const FAILURE_BOUNDS_EXCEEDED = {
  code: "HOME_FEED_EXECUTION_BOUNDS_EXCEEDED",
  message: "Home-feed execution bounds exceed permitted ceilings.",
} as const;
const FAILURE_CHECKOUT_FAILED = {
  code: "HOME_FEED_CHECKOUT_FAILED",
  message: "Home-feed profile checkout failed.",
} as const;
const FAILURE_PROFILE_MISMATCH = {
  code: "PROFILE_HOME_FEED_CHECKOUT_PROFILE_MISMATCH",
  message:
    "Profile Manager checkout returned a different profile than the run target.",
} as const;
const FAILURE_CAPTURE_FAILED = {
  code: "HOME_FEED_CAPTURE_FAILED",
  message: "Home-feed payload capture failed.",
} as const;
const FAILURE_LEASE_RELEASE_FAILED = {
  code: "HOME_FEED_LEASE_RELEASE_FAILED",
  message: "Profile lease release failed after home-feed capture.",
} as const;
const FAILURE_PARTIAL = {
  code: "HOME_FEED_EXECUTION_PARTIAL_FAILURE",
  message:
    "Home-feed execution completed with one or more publisher or content failures.",
} as const;
const FAILURE_INTERRUPTED = {
  code: "HOME_FEED_EXECUTION_INTERRUPTED",
  message: "Home-feed execution was interrupted before completion.",
} as const;

const LOGIN_REQUIRED_CODE = "LOGIN_REQUIRED";
const CHECKPOINT_REQUIRED_CODE = "CHECKPOINT_REQUIRED";

type PublisherCacheEntry =
  | { readonly ok: true; readonly sourcePublisherId: string }
  | { readonly ok: false };

interface EffectiveBounds {
  readonly maxScrolls: number;
  readonly maxDurationMs: number;
  readonly maxPosts: number;
}

interface MutableSummary {
  capturedPayloads: number;
  extractorCandidates: number;
  sourcePublishersObserved: number;
  contentItemsSubmitted: number;
  failedPublisherObservations: number;
  failedContentSubmissions: number;
  leaseReleased: boolean;
}

export class ExecuteProfileHomeFeedCollectionRunUseCase {
  public constructor(
    private readonly runs: ProfileHomeFeedCollectionRunRepository,
    private readonly markSucceeded: MarkProfileHomeFeedCollectionRunSucceededUseCase,
    private readonly markFailed: MarkProfileHomeFeedCollectionRunFailedUseCase,
    private readonly checkoutPort: ProfileHomeFeedCheckoutPort,
    private readonly leasePort: ProfileLeasePort,
    private readonly capturePort: FacebookHomeFeedPayloadCapturePort,
    private readonly publisherObservationPort: SourcePublisherObservationPort,
    private readonly contentSubmissionPort: HomeFeedContentSubmissionPort,
    private readonly extractor: HomeFeedExtractorLike,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: ExecuteProfileHomeFeedCollectionRunInput,
  ): Promise<ProfileHomeFeedCollectionRun> {
    const run = await loadValidatedProfileHomeFeedCollectionRunById(
      this.runs,
      input.runId,
    );

    if (run.status !== "RUNNING") {
      throw new InvalidProfileHomeFeedCollectionRunStatusTransitionError(
        run.status,
        "SUCCEEDED",
      );
    }

    const bounds = computeEffectiveBounds(run.parameters);

    if (boundsExceedCeilings(bounds)) {
      return this.failRun(run.id, FAILURE_BOUNDS_EXCEEDED, undefined);
    }

    if (input.abortSignal?.aborted === true) {
      return this.failRun(run.id, FAILURE_INTERRUPTED, undefined);
    }

    const checkoutResult = await safeCheckout(this.checkoutPort, run.profileId);

    if (!checkoutResult.ok) {
      return this.failRun(run.id, FAILURE_CHECKOUT_FAILED, undefined);
    }

    if (checkoutResult.profileId !== run.profileId) {
      return this.failRun(run.id, FAILURE_PROFILE_MISMATCH, undefined);
    }

    const leaseId = checkoutResult.leaseId;
    const summary: MutableSummary = createEmptySummary();

    const captureResult = await safeCapture(this.capturePort, {
      profileId: run.profileId,
      leaseId,
      maxScrolls: bounds.maxScrolls,
      maxDurationMs: bounds.maxDurationMs,
    });

    if (!captureResult.ok) {
      const authObs = toAuthenticationObservation(captureResult.errorCode);
      const release = await safeRelease(
        this.leasePort,
        run.profileId,
        leaseId,
        authObs,
      );
      summary.leaseReleased = release.ok;
      return this.failRun(run.id, FAILURE_CAPTURE_FAILED, summary);
    }

    summary.capturedPayloads = captureResult.capturedPayloads.length;

    const candidates = collectCandidates(
      captureResult.capturedPayloads,
      this.extractor,
      bounds.maxPosts,
    );
    summary.extractorCandidates = candidates.length;

    const publisherCache = new Map<string, PublisherCacheEntry>();
    const observedAt = this.clock.now().toISOString();

    for (const candidate of candidates) {
      const publisherKey = buildPublisherKey(candidate);
      const cached = publisherCache.get(publisherKey);
      let sourcePublisherId: string | undefined;

      if (cached === undefined) {
        const observation = await safeObservePublisher(
          this.publisherObservationPort,
          candidate,
          observedAt,
        );

        if (observation.ok) {
          publisherCache.set(publisherKey, {
            ok: true,
            sourcePublisherId: observation.sourcePublisherId,
          });
          summary.sourcePublishersObserved += 1;
          sourcePublisherId = observation.sourcePublisherId;
        } else {
          publisherCache.set(publisherKey, { ok: false });
          summary.failedPublisherObservations += 1;
          summary.failedContentSubmissions += 1;
          continue;
        }
      } else if (cached.ok) {
        sourcePublisherId = cached.sourcePublisherId;
      } else {
        summary.failedContentSubmissions += 1;
        continue;
      }

      const submission = await safeSubmitContent(
        this.contentSubmissionPort,
        candidate,
        sourcePublisherId,
      );

      if (!submission.ok) {
        summary.failedContentSubmissions += 1;
        continue;
      }

      summary.contentItemsSubmitted += 1;
    }

    const release = await safeRelease(
      this.leasePort,
      run.profileId,
      leaseId,
      undefined,
    );
    summary.leaseReleased = release.ok;

    if (!release.ok) {
      return this.failRun(run.id, FAILURE_LEASE_RELEASE_FAILED, summary);
    }

    if (
      summary.failedPublisherObservations === 0 &&
      summary.failedContentSubmissions === 0
    ) {
      return this.markSucceeded.execute({
        runId: run.id,
        summary: toImmutableSummary(summary),
      });
    }

    return this.failRun(run.id, FAILURE_PARTIAL, summary);
  }

  private async failRun(
    runId: ProfileHomeFeedCollectionRunId,
    failureReason: ProfileHomeFeedCollectionRunFailureReason,
    summary: MutableSummary | undefined,
  ): Promise<ProfileHomeFeedCollectionRun> {
    const summaryValue =
      summary === undefined ? undefined : toImmutableSummary(summary);

    try {
      return await this.markFailed.execute({
        runId,
        failureReason,
        ...(summaryValue === undefined ? {} : { summary: summaryValue }),
      });
    } catch (error) {
      if (error instanceof ProfileHomeFeedCollectionRunNotFoundError) {
        throw error;
      }
      throw error;
    }
  }
}

function computeEffectiveBounds(
  parameters: ProfileHomeFeedCollectionRun["parameters"],
): EffectiveBounds {
  return {
    maxScrolls:
      parameters.maxScrolls ?? HOME_FEED_EXECUTION_DEFAULT_MAX_SCROLLS,
    maxDurationMs:
      parameters.maxDurationMs ?? HOME_FEED_EXECUTION_DEFAULT_MAX_DURATION_MS,
    maxPosts: parameters.maxPosts ?? HOME_FEED_EXECUTION_DEFAULT_MAX_POSTS,
  };
}

function boundsExceedCeilings(bounds: EffectiveBounds): boolean {
  return (
    bounds.maxScrolls > HOME_FEED_EXECUTION_MAX_SCROLLS_CEILING ||
    bounds.maxDurationMs > HOME_FEED_EXECUTION_MAX_DURATION_MS_CEILING ||
    bounds.maxPosts > HOME_FEED_EXECUTION_MAX_POSTS_CEILING
  );
}

function createEmptySummary(): MutableSummary {
  return {
    capturedPayloads: 0,
    extractorCandidates: 0,
    sourcePublishersObserved: 0,
    contentItemsSubmitted: 0,
    failedPublisherObservations: 0,
    failedContentSubmissions: 0,
    leaseReleased: false,
  };
}

function toImmutableSummary(
  summary: MutableSummary,
): ProfileHomeFeedCollectionRunSummary {
  return {
    capturedPayloads: summary.capturedPayloads,
    extractorCandidates: summary.extractorCandidates,
    sourcePublishersObserved: summary.sourcePublishersObserved,
    contentItemsSubmitted: summary.contentItemsSubmitted,
    failedPublisherObservations: summary.failedPublisherObservations,
    failedContentSubmissions: summary.failedContentSubmissions,
    leaseReleased: summary.leaseReleased,
  };
}

async function safeCheckout(
  port: ProfileHomeFeedCheckoutPort,
  profileId: string,
): Promise<
  | {
      readonly ok: true;
      readonly profileId: string;
      readonly leaseId: string;
    }
  | { readonly ok: false }
> {
  try {
    const result = await port.checkoutProfileForHomeFeedCollection(profileId);

    if (!result.ok) {
      return { ok: false };
    }

    return {
      ok: true,
      profileId: result.profileId,
      leaseId: result.leaseId,
    };
  } catch {
    return { ok: false };
  }
}

async function safeCapture(
  port: FacebookHomeFeedPayloadCapturePort,
  input: {
    readonly profileId: string;
    readonly leaseId: string;
    readonly maxScrolls: number;
    readonly maxDurationMs: number;
  },
): Promise<
  | {
      readonly ok: true;
      readonly capturedPayloads: ReadonlyArray<{
        readonly capturedAt: Date;
        readonly payload: unknown;
      }>;
    }
  | {
      readonly ok: false;
      readonly errorCode: string;
    }
> {
  try {
    const result = await port.captureHomeFeedPayloads(input);

    if (!result.ok) {
      return { ok: false, errorCode: result.errorCode };
    }

    return {
      ok: true,
      capturedPayloads: result.capturedPayloads.map((payload) => ({
        capturedAt: payload.capturedAt,
        payload: payload.payload,
      })),
    };
  } catch {
    return { ok: false, errorCode: "HOME_FEED_CAPTURE_PORT_ERROR" };
  }
}

function toAuthenticationObservation(
  errorCode: string,
): ProfileAuthenticationObservation | undefined {
  if (errorCode === LOGIN_REQUIRED_CODE) {
    return "LOGIN_REQUIRED";
  }
  if (errorCode === CHECKPOINT_REQUIRED_CODE) {
    return "CHECKPOINT_REQUIRED";
  }
  return undefined;
}

function collectCandidates(
  capturedPayloads: ReadonlyArray<{
    readonly capturedAt: Date;
    readonly payload: unknown;
  }>,
  extractor: HomeFeedExtractorLike,
  maxPosts: number,
): readonly FacebookHomeFeedExtractedContentCandidate[] {
  const accepted: FacebookHomeFeedExtractedContentCandidate[] = [];
  const seenPostKeys = new Set<string>();

  for (const capturedPayload of capturedPayloads) {
    if (accepted.length >= maxPosts) {
      break;
    }

    let extraction: FacebookHomeFeedGraphQLExtractionResult;

    try {
      extraction = extractor.extract({
        capturedAt: capturedPayload.capturedAt,
        payload: capturedPayload.payload,
      });
    } catch {
      continue;
    }

    if (!extraction.valid) {
      continue;
    }

    for (const candidate of extraction.candidates) {
      const key = `${candidate.platform}|${candidate.externalPostId}`;

      if (seenPostKeys.has(key)) {
        continue;
      }

      if (accepted.length >= maxPosts) {
        break;
      }

      seenPostKeys.add(key);
      accepted.push(candidate);
    }
  }

  return accepted;
}

function buildPublisherKey(
  candidate: FacebookHomeFeedExtractedContentCandidate,
): string {
  const observation = candidate.publisherObservation;
  return `${observation.platform}|${observation.kind}|${observation.externalPublisherId}`;
}

async function safeObservePublisher(
  port: SourcePublisherObservationPort,
  candidate: FacebookHomeFeedExtractedContentCandidate,
  observedAt: string,
): Promise<
  | { readonly ok: true; readonly sourcePublisherId: string }
  | { readonly ok: false }
> {
  const observation = candidate.publisherObservation;

  try {
    const result = await port.observeSourcePublisher({
      platform: observation.platform,
      kind: observation.kind,
      externalPublisherId: observation.externalPublisherId,
      observedAt,
      ...(observation.displayName !== undefined
        ? { displayName: observation.displayName }
        : {}),
      ...(observation.canonicalUrl !== undefined
        ? { canonicalUrl: observation.canonicalUrl }
        : {}),
    });

    if (result.ok) {
      return { ok: true, sourcePublisherId: result.sourcePublisherId };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

async function safeSubmitContent(
  port: HomeFeedContentSubmissionPort,
  candidate: FacebookHomeFeedExtractedContentCandidate,
  sourcePublisherId: string,
): Promise<{ readonly ok: boolean }> {
  const submissionInput: HomeFeedContentSubmissionInput = {
    sourcePublisherId,
    platform: candidate.platform,
    externalPostId: candidate.externalPostId,
    sourceUrl: candidate.sourceUrl,
    bodyText: candidate.bodyText,
    collectedAt: candidate.collectedAt,
    reactionCount: candidate.reactionCount,
    commentCount: candidate.commentCount,
    topComments: candidate.topComments.map((comment) => ({
      externalCommentId: comment.externalCommentId,
      bodyText: comment.bodyText,
      reactionCount: comment.reactionCount,
      collectedAt: comment.collectedAt,
      ...(comment.authorDisplayName !== undefined
        ? { authorDisplayName: comment.authorDisplayName }
        : {}),
      ...(comment.authorExternalId !== undefined
        ? { authorExternalId: comment.authorExternalId }
        : {}),
      ...(comment.replyCount !== undefined
        ? { replyCount: comment.replyCount }
        : {}),
      ...(comment.postedAt !== undefined ? { postedAt: comment.postedAt } : {}),
    })),
    ...(candidate.title !== undefined ? { title: candidate.title } : {}),
    ...(candidate.authorDisplayName !== undefined
      ? { authorDisplayName: candidate.authorDisplayName }
      : {}),
    ...(candidate.authorExternalId !== undefined
      ? { authorExternalId: candidate.authorExternalId }
      : {}),
    ...(candidate.postedAt !== undefined ? { postedAt: candidate.postedAt } : {}),
    ...(candidate.shareCount !== undefined
      ? { shareCount: candidate.shareCount }
      : {}),
  };

  try {
    const result = await port.submitHomeFeedCollectedContent(submissionInput);
    return { ok: result.ok };
  } catch {
    return { ok: false };
  }
}

async function safeRelease(
  port: ProfileLeasePort,
  profileId: string,
  leaseId: string,
  authenticationObservation: ProfileAuthenticationObservation | undefined,
): Promise<{ readonly ok: boolean }> {
  try {
    const result = await port.releaseProfileLease({
      profileId,
      leaseId,
      ...(authenticationObservation !== undefined
        ? { authenticationObservation }
        : {}),
    });
    return { ok: result.ok };
  } catch {
    return { ok: false };
  }
}
