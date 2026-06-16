import {
  ClaimNextProfileSourceAccessCheckRunUseCase,
  ExecuteProfileSourceAccessCheckRunUseCase,
  type BrowserProviderPort,
  type Clock,
  type ProfileSourceAccessBrowserCheckPort,
  type ProfileSourceAccessCheckRunRepository,
  type ProfileSourceAccessMutationPort,
  type ProfileSourceAccessOutcomeClassifierPort,
} from "../../collector-runtime/application";
import {
  DeterministicProfileSourceAccessOutcomeClassifier,
  ProfileManagerHttpClient,
  ProfileManagerHttpProfileSourceAccessMutationAdapter,
  ProfileSourceAccessBrowserCheckAdapter,
  resolveBrowserProvider,
} from "../../collector-runtime/infrastructure";
import {
  DrizzleProfileSourceAccessCheckRunRepository,
  createDatabaseClient,
  type DatabaseClient,
} from "../../infrastructure/database";
import { SystemClock } from "../../infrastructure/system";
import type { ProfileSourceAccessCheckWorkerCliArgs } from "./cli-args";

export interface ProfileSourceAccessCheckWorkerLogger {
  info(message: string): void;
  error?(message: string): void;
}

export interface ProfileSourceAccessCheckWorkerDependencies {
  readonly checkRuns?: ProfileSourceAccessCheckRunRepository;
  readonly browserCheck?: ProfileSourceAccessBrowserCheckPort;
  readonly classifier?: ProfileSourceAccessOutcomeClassifierPort;
  readonly mutation?: ProfileSourceAccessMutationPort;
  readonly browserProvider?: BrowserProviderPort;
  readonly clock?: Clock;
  readonly close?: () => Promise<void>;
}

export interface RunProfileSourceAccessCheckWorkerCommandInput {
  readonly args: ProfileSourceAccessCheckWorkerCliArgs;
  readonly logger?: ProfileSourceAccessCheckWorkerLogger;
  readonly abortSignal?: AbortSignal;
  readonly dependencies?: ProfileSourceAccessCheckWorkerDependencies;
}

export interface ProfileSourceAccessCheckWorkerCommandResult {
  claimedRuns: number;
  succeededRuns: number;
  failedRuns: number;
}

interface BuiltDependencies {
  readonly checkRuns: ProfileSourceAccessCheckRunRepository;
  readonly browserCheck: ProfileSourceAccessBrowserCheckPort;
  readonly classifier: ProfileSourceAccessOutcomeClassifierPort;
  readonly mutation: ProfileSourceAccessMutationPort;
  readonly clock: Clock;
  readonly close: () => Promise<void>;
}

const NOOP_LOGGER: ProfileSourceAccessCheckWorkerLogger = {
  info() {},
};

export async function runProfileSourceAccessCheckWorkerCommand(
  input: RunProfileSourceAccessCheckWorkerCommandInput,
): Promise<ProfileSourceAccessCheckWorkerCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const dependencies = buildDependencies(input);
  const result = {
    claimedRuns: 0,
    succeededRuns: 0,
    failedRuns: 0,
  };

  logger.info("Profile-source access check worker started.");

  try {
    if (input.args.once) {
      return await runOneWorkerIteration(
        dependencies,
        logger,
        result,
        input.abortSignal,
      );
    }

    while (!input.abortSignal?.aborted) {
      await runOneWorkerIteration(
        dependencies,
        logger,
        result,
        input.abortSignal,
      );
      await delay(input.args.pollIntervalMs, input.abortSignal);
    }

    return result;
  } finally {
    await dependencies.close();
    logger.info("Profile-source access check worker stopped.");
  }
}

async function runOneWorkerIteration(
  dependencies: BuiltDependencies,
  logger: ProfileSourceAccessCheckWorkerLogger,
  totals: ProfileSourceAccessCheckWorkerCommandResult,
  abortSignal: AbortSignal | undefined,
): Promise<ProfileSourceAccessCheckWorkerCommandResult> {
  const claimNext = new ClaimNextProfileSourceAccessCheckRunUseCase(
    dependencies.checkRuns,
    dependencies.clock,
  );
  const claimedRun = await claimNext.execute();

  if (claimedRun === null) {
    logger.info("No queued profile-source access check run found.");
    return totals;
  }

  totals.claimedRuns += 1;
  logger.info(`Claimed profile-source access check run ${claimedRun.id}.`);

  const completedRun = await new ExecuteProfileSourceAccessCheckRunUseCase(
    dependencies.checkRuns,
    dependencies.browserCheck,
    dependencies.classifier,
    dependencies.mutation,
    dependencies.clock,
  ).execute({
    checkRunId: claimedRun.id,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  });

  if (completedRun.status === "SUCCEEDED") {
    totals.succeededRuns += 1;
    logger.info(
      `Profile-source access check run ${completedRun.id} succeeded: outcome=${completedRun.outcome}.`,
    );
    return totals;
  }

  totals.failedRuns += 1;
  logError(
    logger,
    `Profile-source access check run ${completedRun.id} failed: ` +
      formatFailureReason(completedRun.failureReason),
  );
  return totals;
}

function buildDependencies(
  input: RunProfileSourceAccessCheckWorkerCommandInput,
): BuiltDependencies {
  const clock = input.dependencies?.clock ?? new SystemClock();
  let databaseClient: DatabaseClient | undefined;
  const checkRuns =
    input.dependencies?.checkRuns ??
    (() => {
      databaseClient = createDatabaseClient();
      return new DrizzleProfileSourceAccessCheckRunRepository(databaseClient.db);
    })();
  const profileManager = new ProfileManagerHttpClient({
    baseUrl: input.args.baseUrl,
  });
  const browserProvider =
    input.dependencies?.browserProvider ??
    resolveBrowserProviderForCommand(input.args.browserProvider);
  const browserCheck =
    input.dependencies?.browserCheck ??
    new ProfileSourceAccessBrowserCheckAdapter(profileManager, browserProvider, {
      now: () => clock.now(),
    });
  const mutation =
    input.dependencies?.mutation ??
    new ProfileManagerHttpProfileSourceAccessMutationAdapter(profileManager);

  return {
    checkRuns,
    browserCheck,
    classifier:
      input.dependencies?.classifier ??
      new DeterministicProfileSourceAccessOutcomeClassifier(),
    mutation,
    clock,
    close:
      input.dependencies?.close ??
      (async () => {
        await databaseClient?.close();
      }),
  };
}

function resolveBrowserProviderForCommand(
  browserProvider: ProfileSourceAccessCheckWorkerCliArgs["browserProvider"],
): BrowserProviderPort {
  const resolution = resolveBrowserProvider({ browserProvider });

  if (!resolution.ok) {
    throw new Error(resolution.message);
  }

  return resolution.provider;
}

function formatFailureReason(
  failureReason:
    | { readonly code: string; readonly message: string }
    | undefined,
): string {
  if (failureReason === undefined) {
    return "code=ACCESS_CHECK_FAILED message=\"Profile-source access check failed.\"";
  }

  return `code=${failureReason.code} message="${failureReason.message}"`;
}

function logError(
  logger: ProfileSourceAccessCheckWorkerLogger,
  message: string,
): void {
  if (logger.error !== undefined) {
    logger.error(message);
    return;
  }

  logger.info(message);
}

function delay(
  milliseconds: number,
  abortSignal: AbortSignal | undefined,
): Promise<void> {
  if (abortSignal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);

    if (abortSignal !== undefined) {
      abortSignal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    }
  });
}
