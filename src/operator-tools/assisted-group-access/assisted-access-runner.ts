import type {
  BrowserProviderPage,
  BrowserProviderPort,
  BrowserProviderSession,
  ProfileLeaseReleaseInput,
  ProfileLeaseReleaseResult,
  RuntimeProfileConfigurationResult,
  SourceGroupLookupResult,
  SourceGroupLookupSourceGroup,
} from "../../collector-runtime/application";
import {
  ContentManagerHttpClient,
  ProfileManagerHttpClient,
  buildBrowserProviderLaunchConfig,
  resolveBrowserProvider,
  type ProfileAssistedGroupAccessCheckoutResult,
} from "../../collector-runtime/infrastructure";
import type { AssistedGroupAccessCliArgs } from "./cli-args";

export type AssistedAccessCompletionReason =
  | "OPERATOR_COMPLETED"
  | "TIMEOUT"
  | "ABORTED";

export interface AssistedAccessSessionControlPort {
  waitForCompletion(input: {
    readonly maxDurationMs: number;
    readonly abortSignal?: AbortSignal;
  }): Promise<AssistedAccessCompletionReason>;
}

export interface AssistedAccessLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface AssistedAccessContentManagerPort {
  getSourceGroup(sourceGroupId: string): Promise<SourceGroupLookupResult>;
}

export interface AssistedAccessProfileManagerPort {
  checkoutProfileForAssistedGroupAccess(
    profileId: string,
    sourceGroupId: string,
  ): Promise<ProfileAssistedGroupAccessCheckoutResult>;
  getRuntimeProfileConfiguration(
    leaseId: string,
  ): Promise<RuntimeProfileConfigurationResult>;
  releaseProfileLease(
    input: ProfileLeaseReleaseInput,
  ): Promise<ProfileLeaseReleaseResult>;
}

export interface AssistedAccessDependencies {
  readonly contentManager?: AssistedAccessContentManagerPort;
  readonly profileManager?: AssistedAccessProfileManagerPort;
  readonly browserProvider?: BrowserProviderPort;
  readonly sessionControl?: AssistedAccessSessionControlPort;
  readonly close?: () => Promise<void>;
}

export interface RunAssistedAccessCommandInput {
  readonly args: AssistedGroupAccessCliArgs;
  readonly logger?: AssistedAccessLogger;
  readonly abortSignal?: AbortSignal;
  readonly dependencies?: AssistedAccessDependencies;
  readonly now?: () => Date;
}

export interface AssistedAccessSelectedRoute {
  readonly id: string;
  readonly type: string;
  readonly url: string;
  readonly riskLevel: string;
  readonly isDefault: boolean;
  readonly derived: boolean;
}

export interface AssistedAccessCommandResult {
  readonly ok: boolean;
  readonly profileId: string;
  readonly sourceGroupId: string;
  readonly leaseId?: string;
  readonly selectedRoute?: AssistedAccessSelectedRoute;
  readonly pageLoaded: boolean;
  readonly completionReason?: AssistedAccessCompletionReason;
  readonly leaseReleased: boolean;
  readonly durationMs: number;
  readonly errors: readonly AssistedAccessCommandError[];
}

export interface AssistedAccessCommandError {
  readonly code: string;
  readonly message: string;
  readonly causeCode?: string;
  readonly statusCode?: number;
}

type RouteSelectionResult =
  | {
      readonly ok: true;
      readonly route: AssistedAccessSelectedRoute;
    }
  | {
      readonly ok: false;
      readonly error: AssistedAccessCommandError;
    };

const NOOP_LOGGER: AssistedAccessLogger = {
  info() {},
};
const SHUTDOWN_MARGIN_MS = 5_000;
const NAVIGATION_TIMEOUT_MS = 30_000;

export async function runAssistedAccessCommand(
  input: RunAssistedAccessCommandInput,
): Promise<AssistedAccessCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const startedAt = (input.now ?? (() => new Date()))();
  const dependencies = buildDependencies(input);
  let leaseId: string | undefined;
  let leaseExpiresAt: string | undefined;
  let leaseReleased = false;
  let session: BrowserProviderSession | undefined;
  let selectedRoute: AssistedAccessSelectedRoute | undefined;
  let pageLoaded = false;
  let completionReason: AssistedAccessCompletionReason | undefined;
  let shouldLaunchBrowser = true;
  let navigationBudgetMs = 0;
  const errors: AssistedAccessCommandError[] = [];
  const now = input.now ?? (() => new Date());

  logger.info("Starting assisted group access browser session.");
  logger.info(`Using profile id ${input.args.profileId}.`);
  logger.info(`Using source group id ${input.args.sourceGroupId}.`);

  try {
    const sourceGroupResult = await dependencies.contentManager.getSourceGroup(
      input.args.sourceGroupId,
    );

    if (!sourceGroupResult.ok) {
      errors.push(toCommandError("SOURCE_GROUP_LOOKUP_FAILED", sourceGroupResult));
      return finish();
    }

    const routeSelection = selectEntryRoute({
      sourceGroup: sourceGroupResult.sourceGroup,
      ...(input.args.entryRouteId !== undefined
        ? { explicitEntryRouteId: input.args.entryRouteId }
        : {}),
      allowHighRiskRoute: input.args.allowHighRiskRoute,
    });

    if (!routeSelection.ok) {
      errors.push(routeSelection.error);
      return finish();
    }

    selectedRoute = routeSelection.route;
    logger.info(
      `Selected route ${selectedRoute.id} (${selectedRoute.type}, ${selectedRoute.riskLevel}).`,
    );

    const checkoutResult =
      await dependencies.profileManager.checkoutProfileForAssistedGroupAccess(
        input.args.profileId,
        input.args.sourceGroupId,
      );

    if (!checkoutResult.ok) {
      errors.push(toCommandError("ASSISTED_ACCESS_CHECKOUT_FAILED", checkoutResult));
      return finish();
    }

    leaseId = checkoutResult.leaseId;
    leaseExpiresAt = checkoutResult.leaseExpiresAt;
    logger.info("Checked out assisted group access lease.");

    const runtimeConfigurationResult =
      await dependencies.profileManager.getRuntimeProfileConfiguration(leaseId);

    if (!runtimeConfigurationResult.ok) {
      errors.push(
        toCommandError("RUNTIME_CONFIGURATION_FAILED", runtimeConfigurationResult),
      );
      shouldLaunchBrowser = false;
    }

    const safeDeadlineMs = calculateSafeDeadlineMs({
      commandStartedAt: startedAt,
      requestedDurationMs: input.args.maxDurationMs,
      ...(leaseExpiresAt !== undefined ? { leaseExpiresAt } : {}),
    });

    if (getRemainingTimeMs(safeDeadlineMs, now) <= 0) {
      errors.push({
        code: "LEASE_EXPIRY_TOO_CLOSE",
        message: "Lease expiry is too close to start an assisted access session.",
      });
      shouldLaunchBrowser = false;
    }

    if (shouldLaunchBrowser && runtimeConfigurationResult.ok) {
      session = await dependencies.browserProvider.launch(
        buildBrowserProviderLaunchConfig({
          providerName: dependencies.browserProvider.providerName,
          configuration: runtimeConfigurationResult.configuration,
          headless: false,
        }),
      );

      navigationBudgetMs = getRemainingTimeMs(safeDeadlineMs, now);

      if (navigationBudgetMs <= 0) {
        errors.push({
          code: "LEASE_EXPIRY_TOO_CLOSE",
          message: "Lease expiry is too close to start an assisted access session.",
        });
        shouldLaunchBrowser = false;
      }
    }

    if (shouldLaunchBrowser && runtimeConfigurationResult.ok && session !== undefined) {
      const page = await session.newPage();
      pageLoaded = await navigateToSelectedRoute(
        page,
        selectedRoute.url,
        navigationBudgetMs,
      );

      const operatorBudgetMs = getRemainingTimeMs(safeDeadlineMs, now);

      if (operatorBudgetMs <= 0) {
        errors.push({
          code: "LEASE_EXPIRY_TOO_CLOSE",
          message: "Lease expiry is too close to start an assisted access session.",
        });
      } else {
        completionReason = await dependencies.sessionControl.waitForCompletion({
          maxDurationMs: operatorBudgetMs,
          ...(input.abortSignal !== undefined
            ? { abortSignal: input.abortSignal }
            : {}),
        });

        if (completionReason === "ABORTED") {
          errors.push({
            code: "OPERATOR_SESSION_ABORTED",
            message: "Assisted access session was aborted.",
          });
        }
      }
    }
  } catch (error) {
    errors.push(toUnknownFailure(error));
  } finally {
    if (session !== undefined) {
      const closeResult = await closeBrowserSession(session, logger);
      if (!closeResult.ok) {
        errors.push(closeResult.error);
      }
      session = undefined;
    }

    if (leaseId !== undefined && !leaseReleased) {
      const releaseResult = await releaseLease(
        dependencies.profileManager,
        input.args.profileId,
        leaseId,
      );
      leaseReleased = releaseResult.ok;

      if (!releaseResult.ok) {
        errors.push(toCommandError("PROFILE_LEASE_RELEASE_FAILED", releaseResult));
      }
    }

    await dependencies.close();
  }

  return finish();

  function finish(): AssistedAccessCommandResult {
    const result = {
      ok: errors.length === 0 && pageLoaded && leaseReleased,
      profileId: input.args.profileId,
      sourceGroupId: input.args.sourceGroupId,
      ...(leaseId !== undefined ? { leaseId } : {}),
      ...(selectedRoute !== undefined ? { selectedRoute } : {}),
      pageLoaded,
      ...(completionReason !== undefined ? { completionReason } : {}),
      leaseReleased,
      durationMs: getDurationMs(startedAt, now),
      errors,
    };

    logSafeSummary(logger, result);

    return result;
  }
}

function buildDependencies(input: RunAssistedAccessCommandInput): {
  readonly contentManager: AssistedAccessContentManagerPort;
  readonly profileManager: AssistedAccessProfileManagerPort;
  readonly browserProvider: BrowserProviderPort;
  readonly sessionControl: AssistedAccessSessionControlPort;
  readonly close: () => Promise<void>;
} {
  const browserProvider =
    input.dependencies?.browserProvider ??
    resolveBrowserProviderForCommand(input.args.browserProvider);

  return {
    contentManager:
      input.dependencies?.contentManager ??
      new ContentManagerHttpClient({ baseUrl: input.args.baseUrl }),
    profileManager:
      input.dependencies?.profileManager ??
      new ProfileManagerHttpClient({ baseUrl: input.args.baseUrl }),
    browserProvider,
    sessionControl:
      input.dependencies?.sessionControl ?? createUnavailableSessionControl(),
    close: input.dependencies?.close ?? (async () => {}),
  };
}

export function selectEntryRoute(input: {
  readonly sourceGroup: SourceGroupLookupSourceGroup;
  readonly explicitEntryRouteId?: string;
  readonly allowHighRiskRoute: boolean;
}): RouteSelectionResult {
  const { sourceGroup } = input;

  if (sourceGroup.platform !== "FACEBOOK") {
    return routeSelectionFailure(
      "SOURCE_GROUP_PLATFORM_NOT_SUPPORTED",
      "Assisted access requires a FACEBOOK source group.",
    );
  }

  if (sourceGroup.status !== "ACTIVE") {
    return routeSelectionFailure(
      "SOURCE_GROUP_NOT_ACTIVE",
      "Assisted access requires an ACTIVE source group.",
    );
  }

  let selectedRoute: AssistedAccessSelectedRoute | undefined;
  const entryRoutes = sourceGroup.entryRoutes ?? [];

  if (input.explicitEntryRouteId !== undefined) {
    const matchingRoute = entryRoutes.find(
      (route) => route.id === input.explicitEntryRouteId,
    );

    if (matchingRoute === undefined) {
      return routeSelectionFailure(
        "ENTRY_ROUTE_NOT_FOUND",
        "The requested entry route was not found on the source group.",
      );
    }

    selectedRoute = {
      ...matchingRoute,
      derived: false,
    };
  } else {
    const defaultRoutes = entryRoutes.filter((route) => route.isDefault);

    if (defaultRoutes.length > 1) {
      return routeSelectionFailure(
        "MULTIPLE_DEFAULT_ENTRY_ROUTES",
        "Source group has multiple default entry routes.",
      );
    }

    const defaultRoute = defaultRoutes[0];

    selectedRoute =
      defaultRoute !== undefined
        ? {
            ...defaultRoute,
            derived: false,
          }
        : {
            id: "derived-direct-group-url",
            type: "DIRECT_GROUP_URL",
            url: sourceGroup.url,
            riskLevel: "MEDIUM",
            isDefault: true,
            derived: true,
          };
  }

  const normalizedUrl = normalizeHttpUrl(selectedRoute.url);

  if (normalizedUrl === undefined) {
    return routeSelectionFailure(
      "ENTRY_ROUTE_URL_INVALID",
      "Selected entry route URL must be a valid http(s) URL.",
    );
  }

  if (selectedRoute.riskLevel === "HIGH" && !input.allowHighRiskRoute) {
    return routeSelectionFailure(
      "HIGH_RISK_ENTRY_ROUTE_REQUIRES_FLAG",
      "Selected entry route is HIGH risk and requires --allow-high-risk-route.",
    );
  }

  return {
    ok: true,
    route: {
      ...selectedRoute,
      url: normalizedUrl,
    },
  };
}

function routeSelectionFailure(
  code: string,
  message: string,
): RouteSelectionResult {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function normalizeHttpUrl(value: string): string | undefined {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value.trim());
  } catch {
    return undefined;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return undefined;
  }

  if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
    return undefined;
  }

  return parsedUrl.toString();
}

async function navigateToSelectedRoute(
  page: BrowserProviderPage,
  url: string,
  maxDurationMs: number,
): Promise<boolean> {
  await page.goto({
    url,
    waitUntil: "domcontentloaded",
    timeoutMs: Math.max(1, Math.min(NAVIGATION_TIMEOUT_MS, maxDurationMs)),
  });

  return true;
}

function calculateSafeDeadlineMs(input: {
  readonly commandStartedAt: Date;
  readonly requestedDurationMs: number;
  readonly leaseExpiresAt?: string;
}): number {
  const requestedDeadlineMs =
    input.commandStartedAt.getTime() + input.requestedDurationMs;

  if (input.leaseExpiresAt === undefined) {
    return requestedDeadlineMs;
  }

  const leaseExpiresAtMs = Date.parse(input.leaseExpiresAt);

  if (!Number.isFinite(leaseExpiresAtMs)) {
    return requestedDeadlineMs;
  }

  return Math.min(requestedDeadlineMs, leaseExpiresAtMs - SHUTDOWN_MARGIN_MS);
}

function getRemainingTimeMs(safeDeadlineMs: number, now: () => Date): number {
  return safeDeadlineMs - now().getTime();
}

async function releaseLease(
  profileManager: AssistedAccessProfileManagerPort,
  profileId: string,
  leaseId: string,
): Promise<ProfileLeaseReleaseResult> {
  try {
    return await profileManager.releaseProfileLease({
      profileId,
      leaseId,
      macroActionsPerformed: 0,
    });
  } catch (error) {
    return {
      ok: false,
      errorCode: "PROFILE_LEASE_RELEASE_PORT_ERROR",
      errorMessage: errorToMessage(error),
    };
  }
}

async function closeBrowserSession(
  session: BrowserProviderSession,
  logger: AssistedAccessLogger,
): Promise<
  | { readonly ok: true }
  | { readonly ok: false; readonly error: AssistedAccessCommandError }
> {
  try {
    await session.close();
    return { ok: true };
  } catch {
    logWarning(logger, "Browser session close failed before lease release.");
    return {
      ok: false,
      error: {
        code: "BROWSER_SESSION_CLOSE_FAILED",
        message: getSafeFailureMessage("BROWSER_SESSION_CLOSE_FAILED"),
      },
    };
  }
}

function resolveBrowserProviderForCommand(
  browserProvider: AssistedGroupAccessCliArgs["browserProvider"],
): BrowserProviderPort {
  const resolution = resolveBrowserProvider({ browserProvider });

  if (!resolution.ok) {
    throw new Error(resolution.message);
  }

  return resolution.provider;
}

function createUnavailableSessionControl(): AssistedAccessSessionControlPort {
  return {
    async waitForCompletion() {
      throw new Error("Assisted access session control adapter is required.");
    },
  };
}

function toCommandError(
  code: string,
  result: {
    readonly statusCode?: number;
    readonly errorCode: string;
    readonly errorMessage: string;
  },
): AssistedAccessCommandError {
  return {
    code: sanitizeFailureCode(code),
    message: getSafeFailureMessage(code),
    causeCode: sanitizeFailureCode(result.errorCode),
    ...(result.statusCode !== undefined ? { statusCode: result.statusCode } : {}),
  };
}

function toUnknownFailure(error: unknown): AssistedAccessCommandError {
  const message = errorToMessage(error).toLowerCase();
  const code =
    message.includes("browser") || message.includes("playwright")
      ? "BROWSER_PROVIDER_FAILED"
      : "UNKNOWN_FAILURE";

  return {
    code,
    message: getSafeFailureMessage(code),
  };
}

function sanitizeFailureCode(code: string | undefined): string {
  const normalizedCode = code?.trim().toUpperCase();

  if (
    normalizedCode !== undefined &&
    /^[A-Z0-9_]+$/.test(normalizedCode) &&
    normalizedCode.length <= 80
  ) {
    return normalizedCode;
  }

  return "UNKNOWN_FAILURE";
}

function getSafeFailureMessage(code: string): string {
  switch (sanitizeFailureCode(code)) {
    case "SOURCE_GROUP_LOOKUP_FAILED":
      return "Source group could not be read.";
    case "ASSISTED_ACCESS_CHECKOUT_FAILED":
      return "Profile assisted group access checkout failed.";
    case "RUNTIME_CONFIGURATION_FAILED":
      return "Runtime profile configuration could not be read.";
    case "PROFILE_LEASE_RELEASE_FAILED":
      return "Profile lease release failed after assisted access.";
    case "BROWSER_PROVIDER_FAILED":
      return "Browser provider failed during assisted access.";
    case "BROWSER_SESSION_CLOSE_FAILED":
      return "Browser session close failed after assisted access.";
    default:
      return "Assisted group access failed.";
  }
}

function logSafeSummary(
  logger: AssistedAccessLogger,
  result: AssistedAccessCommandResult,
): void {
  logger.info("Assisted group access summary:");
  logger.info(`- Profile id: ${result.profileId}`);
  logger.info(`- Source group id: ${result.sourceGroupId}`);
  logger.info(`- Lease id: ${result.leaseId ?? "unavailable"}`);
  logger.info(`- Route id: ${result.selectedRoute?.id ?? "unavailable"}`);
  logger.info(`- Route type: ${result.selectedRoute?.type ?? "unavailable"}`);
  logger.info(`- Route risk: ${result.selectedRoute?.riskLevel ?? "unavailable"}`);
  logger.info(`- Page loaded: ${result.pageLoaded ? "yes" : "no"}`);
  logger.info(`- Completion reason: ${result.completionReason ?? "unavailable"}`);
  logger.info(`- Lease released: ${result.leaseReleased ? "yes" : "no"}`);
  logger.info(`- Duration ms: ${result.durationMs}`);

  if (!result.ok) {
    for (const error of result.errors) {
      const details = [
        error.causeCode !== undefined ? `cause ${error.causeCode}` : undefined,
        error.statusCode !== undefined ? `status ${error.statusCode}` : undefined,
      ].filter((detail): detail is string => detail !== undefined);
      const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";

      logger.error?.(`- Error ${error.code}${suffix}.`);
    }
  }
}

function logWarning(logger: AssistedAccessLogger, message: string): void {
  if (logger.warn !== undefined) {
    logger.warn(message);
    return;
  }

  logger.info(message);
}

function getDurationMs(startedAt: Date, now: () => Date): number {
  return Math.max(0, now().getTime() - startedAt.getTime());
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unknown error.";
}
