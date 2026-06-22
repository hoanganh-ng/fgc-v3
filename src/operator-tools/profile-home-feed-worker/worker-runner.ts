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
import {
  claimAndExecuteNextProfileHomeFeedRun,
  type ProfileHomeFeedClaimAndExecuteDependencies,
  type ProfileHomeFeedRunNextLogger,
} from "../profile-home-feed-runner/runner";
import type { ProfileHomeFeedWorkerCliArgs } from "./cli-args";

export type ProfileHomeFeedWorkerLogger = ProfileHomeFeedRunNextLogger;

export interface ProfileHomeFeedWorkerDependencies {
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

export interface RunProfileHomeFeedWorkerCommandInput {
  readonly args: ProfileHomeFeedWorkerCliArgs;
  readonly logger?: ProfileHomeFeedWorkerLogger;
  readonly abortSignal?: AbortSignal;
  readonly dependencies?: ProfileHomeFeedWorkerDependencies;
}

export interface ProfileHomeFeedWorkerCommandResult {
  readonly ok: boolean;
  readonly claimedRuns: number;
  readonly succeededRuns: number;
  readonly failedRuns: number;
}

interface BuiltDependencies extends ProfileHomeFeedClaimAndExecuteDependencies {
  readonly close: () => Promise<void>;
}

const NOOP_LOGGER: ProfileHomeFeedWorkerLogger = {
  info() {},
};

export async function runProfileHomeFeedWorkerCommand(
  input: RunProfileHomeFeedWorkerCommandInput,
): Promise<ProfileHomeFeedWorkerCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const dependencies = buildDependencies(input);
  const totals = {
    claimedRuns: 0,
    succeededRuns: 0,
    failedRuns: 0,
  };

  logger.info("Profile home-feed worker started.");

  try {
    if (input.args.once) {
      return await runOneWorkerIteration(
        dependencies,
        logger,
        totals,
        input.abortSignal,
      );
    }

    while (input.abortSignal?.aborted !== true) {
      const claimedRunsBeforeIteration = totals.claimedRuns;
      await runOneWorkerIteration(
        dependencies,
        logger,
        totals,
        input.abortSignal,
      );

      if (totals.claimedRuns > claimedRunsBeforeIteration) {
        continue;
      }

      await delay(input.args.pollIntervalMs, input.abortSignal);
    }

    return toCommandResult(totals);
  } finally {
    await dependencies.close();
    logger.info("Profile home-feed worker stopped.");
  }
}

async function runOneWorkerIteration(
  dependencies: ProfileHomeFeedClaimAndExecuteDependencies,
  logger: ProfileHomeFeedWorkerLogger,
  totals: {
    claimedRuns: number;
    succeededRuns: number;
    failedRuns: number;
  },
  abortSignal: AbortSignal | undefined,
): Promise<ProfileHomeFeedWorkerCommandResult> {
  const result = await claimAndExecuteNextProfileHomeFeedRun({
    dependencies,
    logger,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  });

  totals.claimedRuns += result.claimedRuns;
  totals.succeededRuns += result.succeededRuns;
  totals.failedRuns += result.failedRuns;

  return {
    ok: result.ok && totals.failedRuns === 0,
    claimedRuns: totals.claimedRuns,
    succeededRuns: totals.succeededRuns,
    failedRuns: totals.failedRuns,
  };
}

function toCommandResult(totals: {
  readonly claimedRuns: number;
  readonly succeededRuns: number;
  readonly failedRuns: number;
}): ProfileHomeFeedWorkerCommandResult {
  return {
    ok: totals.failedRuns === 0,
    claimedRuns: totals.claimedRuns,
    succeededRuns: totals.succeededRuns,
    failedRuns: totals.failedRuns,
  };
}

function buildDependencies(
  input: RunProfileHomeFeedWorkerCommandInput,
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
  browserProvider: ProfileHomeFeedWorkerCliArgs["browserProvider"],
): BrowserProviderPort {
  const resolution = resolveBrowserProvider({ browserProvider });

  if (!resolution.ok) {
    throw new Error(resolution.message);
  }

  return resolution.provider;
}

function delay(
  milliseconds: number,
  abortSignal: AbortSignal | undefined,
): Promise<void> {
  if (abortSignal?.aborted === true) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let finished = false;
    let timeout: ReturnType<typeof setTimeout>;

    function finish(): void {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeout);
      abortSignal?.removeEventListener("abort", onAbort);
      resolve();
    }

    function onAbort(): void {
      finish();
    }

    timeout = setTimeout(finish, milliseconds);

    if (abortSignal !== undefined) {
      abortSignal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
