import {
  ClaimNextProfileHomeFeedCollectionRunUseCase,
  ExecuteProfileHomeFeedCollectionRunUseCase,
  MarkProfileHomeFeedCollectionRunFailedUseCase,
  MarkProfileHomeFeedCollectionRunSucceededUseCase,
} from "../../collector-runtime/application";
import type {
  BrowserProviderPort,
  Clock,
  FacebookHomeFeedPayloadCapturePort,
  HomeFeedContentSubmissionPort,
  HomeFeedExtractorLike,
  ProfileHomeFeedCheckoutPort,
  ProfileHomeFeedCollectionRunRepository,
  ProfileLeasePort,
  SourcePublisherObservationPort,
} from "../../collector-runtime/application";
import {
  ContentManagerHttpClient,
  FacebookHomeFeedBrowserPayloadCaptureAdapter,
  ProfileManagerHttpClient,
  resolveBrowserProvider,
} from "../../collector-runtime/infrastructure";
import { extractFacebookHomeFeedGraphQLPayload } from "../../collector-runtime/platform-extractors/facebook";
import {
  DrizzleProfileHomeFeedCollectionRunRepository,
  createDatabaseClient,
  type DatabaseClient,
} from "../../infrastructure/database";
import { SystemClock } from "../../infrastructure/system";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunSummary,
} from "../../collector-runtime/domain";
import type { ProfileHomeFeedRunNextCliArgs } from "./cli-args";

export interface ProfileHomeFeedRunNextLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface ProfileHomeFeedRunNextDependencies {
  readonly runs?: ProfileHomeFeedCollectionRunRepository;
  readonly checkoutPort?: ProfileHomeFeedCheckoutPort;
  readonly leasePort?: ProfileLeasePort;
  readonly capturePort?: FacebookHomeFeedPayloadCapturePort;
  readonly publisherObservationPort?: SourcePublisherObservationPort;
  readonly contentSubmissionPort?: HomeFeedContentSubmissionPort;
  readonly extractor?: HomeFeedExtractorLike;
  readonly browserProvider?: BrowserProviderPort;
  readonly clock?: Clock;
  readonly close?: () => Promise<void>;
}

export interface RunProfileHomeFeedRunNextCommandInput {
  readonly args: ProfileHomeFeedRunNextCliArgs;
  readonly logger?: ProfileHomeFeedRunNextLogger;
  readonly abortSignal?: AbortSignal;
  readonly dependencies?: ProfileHomeFeedRunNextDependencies;
}

export interface ProfileHomeFeedRunNextCommandResult {
  readonly ok: boolean;
  readonly claimedRuns: number;
  readonly succeededRuns: number;
  readonly failedRuns: number;
}

interface BuiltDependencies {
  readonly runs: ProfileHomeFeedCollectionRunRepository;
  readonly checkoutPort: ProfileHomeFeedCheckoutPort;
  readonly leasePort: ProfileLeasePort;
  readonly capturePort: FacebookHomeFeedPayloadCapturePort;
  readonly publisherObservationPort: SourcePublisherObservationPort;
  readonly contentSubmissionPort: HomeFeedContentSubmissionPort;
  readonly extractor: HomeFeedExtractorLike;
  readonly clock: Clock;
  readonly close: () => Promise<void>;
}

const NOOP_LOGGER: ProfileHomeFeedRunNextLogger = {
  info() {},
};

export async function runProfileHomeFeedRunNextCommand(
  input: RunProfileHomeFeedRunNextCommandInput,
): Promise<ProfileHomeFeedRunNextCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const dependencies = buildDependencies(input);

  logger.info("Profile home-feed runner started.");

  try {
    if (input.abortSignal?.aborted === true) {
      logger.info("Profile home-feed runner aborted before claim.");
      return { ok: false, claimedRuns: 0, succeededRuns: 0, failedRuns: 0 };
    }

    const claimed = await new ClaimNextProfileHomeFeedCollectionRunUseCase(
      dependencies.runs,
      dependencies.clock,
    ).execute();

    if (claimed === null) {
      logger.info("No queued profile home-feed collection run found.");
      return { ok: true, claimedRuns: 0, succeededRuns: 0, failedRuns: 0 };
    }

    logger.info(
      `Claimed profile home-feed collection run ${claimed.id} for profile ${claimed.profileId}.`,
    );

    const executeUseCase = new ExecuteProfileHomeFeedCollectionRunUseCase(
      dependencies.runs,
      new MarkProfileHomeFeedCollectionRunSucceededUseCase(
        dependencies.runs,
        dependencies.clock,
      ),
      new MarkProfileHomeFeedCollectionRunFailedUseCase(
        dependencies.runs,
        dependencies.clock,
      ),
      dependencies.checkoutPort,
      dependencies.leasePort,
      dependencies.capturePort,
      dependencies.publisherObservationPort,
      dependencies.contentSubmissionPort,
      dependencies.extractor,
      dependencies.clock,
    );

    const finishedRun = await executeUseCase.execute({
      runId: claimed.id,
      ...(input.abortSignal === undefined
        ? {}
        : { abortSignal: input.abortSignal }),
    });

    logSafeSummary(logger, finishedRun);

    if (finishedRun.status === "SUCCEEDED") {
      return { ok: true, claimedRuns: 1, succeededRuns: 1, failedRuns: 0 };
    }

    return { ok: false, claimedRuns: 1, succeededRuns: 0, failedRuns: 1 };
  } finally {
    await dependencies.close();
    logger.info("Profile home-feed runner stopped.");
  }
}

function buildDependencies(
  input: RunProfileHomeFeedRunNextCommandInput,
): BuiltDependencies {
  const clock = input.dependencies?.clock ?? new SystemClock();
  let databaseClient: DatabaseClient | undefined;
  const runs =
    input.dependencies?.runs ??
    (() => {
      databaseClient = createDatabaseClient();
      return new DrizzleProfileHomeFeedCollectionRunRepository(
        databaseClient.db,
      );
    })();
  const profileManager = new ProfileManagerHttpClient({
    baseUrl: input.args.baseUrl,
  });
  const contentManager = new ContentManagerHttpClient({
    baseUrl: input.args.baseUrl,
  });
  const browserProvider =
    input.dependencies?.browserProvider ??
    resolveBrowserProviderForCommand(input.args.browserProvider);
  const capturePort =
    input.dependencies?.capturePort ??
    new FacebookHomeFeedBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: profileManager,
      browserProvider,
      ...(input.abortSignal !== undefined
        ? { abortSignal: input.abortSignal }
        : {}),
    });

  return {
    runs,
    checkoutPort: input.dependencies?.checkoutPort ?? profileManager,
    leasePort: input.dependencies?.leasePort ?? profileManager,
    capturePort,
    publisherObservationPort:
      input.dependencies?.publisherObservationPort ?? contentManager,
    contentSubmissionPort:
      input.dependencies?.contentSubmissionPort ?? contentManager,
    extractor:
      input.dependencies?.extractor ?? {
        extract: extractFacebookHomeFeedGraphQLPayload,
      },
    clock,
    close:
      input.dependencies?.close ??
      (async () => {
        await databaseClient?.close();
      }),
  };
}

function resolveBrowserProviderForCommand(
  browserProvider: ProfileHomeFeedRunNextCliArgs["browserProvider"],
): BrowserProviderPort {
  const resolution = resolveBrowserProvider({ browserProvider });

  if (!resolution.ok) {
    throw new Error(resolution.message);
  }

  return resolution.provider;
}

function logSafeSummary(
  logger: ProfileHomeFeedRunNextLogger,
  run: ProfileHomeFeedCollectionRun,
): void {
  logger.info("Profile home-feed run summary:");
  logger.info(`- Run id: ${run.id}`);
  logger.info(`- Profile id: ${run.profileId}`);
  logger.info(`- Status: ${run.status}`);

  const summary = run.summary;
  if (summary !== undefined) {
    for (const line of formatSummaryLines(summary)) {
      logger.info(line);
    }
  }

  if (run.status === "FAILED" && run.failureReason !== undefined) {
    const message = `Failure code ${run.failureReason.code}: ${run.failureReason.message}`;
    if (logger.error !== undefined) {
      logger.error(message);
    } else {
      logger.info(message);
    }
  }
}

function formatSummaryLines(
  summary: ProfileHomeFeedCollectionRunSummary,
): readonly string[] {
  return [
    `- Captured payloads: ${summary.capturedPayloads ?? 0}`,
    `- Extractor candidates: ${summary.extractorCandidates ?? 0}`,
    `- Source publishers observed: ${summary.sourcePublishersObserved ?? 0}`,
    `- Content items submitted: ${summary.contentItemsSubmitted ?? 0}`,
    `- Failed publisher observations: ${summary.failedPublisherObservations ?? 0}`,
    `- Failed content submissions: ${summary.failedContentSubmissions ?? 0}`,
    `- Lease released: ${summary.leaseReleased === true ? "yes" : "no"}`,
  ];
}
