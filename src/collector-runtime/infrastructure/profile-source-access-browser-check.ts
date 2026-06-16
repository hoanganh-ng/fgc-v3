import type {
  BrowserProviderPort,
  BrowserProviderSession,
  ProfileLeaseReleaseResult,
  RuntimeProfileConfigurationResult,
} from "../application";
import {
  ProfileSourceAccessBrowserObservationSchema,
  type ProfileSourceAccessBrowserObservation,
} from "../application";
import type {
  ProfileSourceAccessBrowserCheckInput,
  ProfileSourceAccessBrowserCheckPort,
  ProfileSourceAccessBrowserCheckResult,
} from "../application/ports/profile-source-access-check-execution.port";
import { buildBrowserProviderLaunchConfig } from "./browser-providers/browser-provider-launch-config";
import type { ProfileAssistedGroupAccessCheckoutResult } from "./profile-manager-http-client";
import {
  observeFacebookPageState,
  type FacebookPageBlockingState,
} from "./facebook-page-state-observer";

export interface ProfileSourceAccessBrowserProfileManagerPort {
  checkoutProfileForAssistedGroupAccess(
    profileId: string,
    sourceGroupId: string,
  ): Promise<ProfileAssistedGroupAccessCheckoutResult>;
  getRuntimeProfileConfiguration(
    leaseId: string,
  ): Promise<RuntimeProfileConfigurationResult>;
  releaseProfileLease(input: {
    readonly profileId: string;
    readonly leaseId: string;
    readonly macroActionsPerformed?: number;
  }): Promise<ProfileLeaseReleaseResult>;
}

export interface ProfileSourceAccessBrowserCheckAdapterOptions {
  readonly navigationTimeoutMs?: number;
  readonly leaseShutdownMarginMs?: number;
  readonly now?: () => Date;
}

const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
const DEFAULT_LEASE_SHUTDOWN_MARGIN_MS = 5_000;
const MIN_SAFE_PHASE_TIMEOUT_MS = 1_000;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

export class ProfileSourceAccessBrowserCheckAdapter
  implements ProfileSourceAccessBrowserCheckPort
{
  private readonly navigationTimeoutMs: number;
  private readonly leaseShutdownMarginMs: number;
  private readonly now: () => Date;

  public constructor(
    private readonly profileManager: ProfileSourceAccessBrowserProfileManagerPort,
    private readonly browserProvider: BrowserProviderPort,
    options: ProfileSourceAccessBrowserCheckAdapterOptions = {},
  ) {
    this.navigationTimeoutMs =
      options.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS;
    this.leaseShutdownMarginMs =
      options.leaseShutdownMarginMs ?? DEFAULT_LEASE_SHUTDOWN_MARGIN_MS;
    this.now = options.now ?? (() => new Date());
  }

  public async check(
    input: ProfileSourceAccessBrowserCheckInput,
  ): Promise<ProfileSourceAccessBrowserCheckResult> {
    let leaseId: string | undefined;
    let leasedProfileId: string | undefined;
    let safeDeadlineAt: number | undefined;
    let session: BrowserProviderSession | undefined;
    let closeFailed: CleanupFailureCode | undefined;
    let releaseResult: ProfileLeaseReleaseResult | undefined;

    try {
      throwIfAborted(input.abortSignal);

      const checkoutResult =
        await this.profileManager.checkoutProfileForAssistedGroupAccess(
          input.profileId,
          input.sourceGroupId,
        );

      if (!checkoutResult.ok) {
        return failure("ACCESS_CHECK_CHECKOUT_FAILED");
      }

      leaseId = checkoutResult.leaseId;
      leasedProfileId = checkoutResult.profileId;
      safeDeadlineAt = this.getRequiredSafeDeadlineAt(
        checkoutResult.leaseExpiresAt,
      );

      if (checkoutResult.profileId !== input.profileId) {
        return failure("ACCESS_CHECK_PROFILE_ID_MISMATCH");
      }

      assertSafeDeadlineReady(safeDeadlineAt, this.now());
      throwIfAborted(input.abortSignal);

      const actualLeaseId = checkoutResult.leaseId;
      const runtimeConfigurationResult =
        await runBoundedPhase(
          () =>
            this.profileManager.getRuntimeProfileConfiguration(actualLeaseId),
          safeDeadlineAt,
          this.now,
          input.abortSignal,
        );

      if (!runtimeConfigurationResult.ok) {
        return failure("ACCESS_CHECK_RUNTIME_CONFIGURATION_FAILED");
      }

      if (runtimeConfigurationResult.configuration.profileId !== input.profileId) {
        return failure("ACCESS_CHECK_RUNTIME_PROFILE_ID_MISMATCH");
      }

      if (runtimeConfigurationResult.configuration.leaseId !== actualLeaseId) {
        return failure("ACCESS_CHECK_RUNTIME_LEASE_ID_MISMATCH");
      }

      assertSafeDeadlineReady(safeDeadlineAt, this.now());
      throwIfAborted(input.abortSignal);

      const launchConfig = buildBrowserProviderLaunchConfig({
        providerName: this.browserProvider.providerName,
        configuration: runtimeConfigurationResult.configuration,
        headless: true,
      });

      session = await runBoundedPhase(
        () => this.browserProvider.launch(launchConfig),
        safeDeadlineAt,
        this.now,
        input.abortSignal,
        (lateSession) => lateSession.close(),
      );
      const activeSession = session;
      const disposeAbortClose = createAbortCloseListener(
        input.abortSignal,
        activeSession,
      );

      try {
        const page = await runBoundedPhase(
          () => activeSession.newPage(),
          safeDeadlineAt,
          this.now,
          input.abortSignal,
        );
        await runBoundedPhase(
          () =>
            page.goto({
              url: input.target.url,
              waitUntil: "domcontentloaded",
              timeoutMs: this.getNavigationTimeoutMs(safeDeadlineAt),
            }),
          safeDeadlineAt,
          this.now,
          input.abortSignal,
        );

        const observedPageState = await runBoundedPhase(
          () =>
            observeFacebookPageState(page, {
              settleMs: 500,
              pollIntervalMs: 100,
              ...(safeDeadlineAt !== undefined ? { deadlineAt: safeDeadlineAt } : {}),
              ...(input.abortSignal !== undefined
                ? { abortSignal: input.abortSignal }
                : {}),
              now: () => this.now().getTime(),
            }),
          safeDeadlineAt,
          this.now,
          input.abortSignal,
        );
        const blockingObservation = toBlockingObservation(
          observedPageState.blockingState,
        );
        const observation =
          blockingObservation ??
          ProfileSourceAccessBrowserObservationSchema.parse(
            await runBoundedPhase(
              () =>
                page.evaluate<unknown>(PROFILE_SOURCE_ACCESS_OBSERVATION_SCRIPT),
              safeDeadlineAt,
              this.now,
              input.abortSignal,
            ),
          );

        throwIfAborted(input.abortSignal);

        const closeResult = await runCleanupPhase(
          () => activeSession.close(),
          safeDeadlineAt,
          this.now,
        );
        session = undefined;
        if (!closeResult.ok) {
          closeFailed = closeResult.code;
        }

        releaseResult = await releaseLeaseSafely(
          this.profileManager,
          leasedProfileId,
          leaseId,
          safeDeadlineAt,
          this.now,
        );

        if (closeFailed === "TIMEOUT") {
          return failure("ACCESS_CHECK_TIMEOUT");
        }

        if (closeFailed !== undefined || !releaseResult.ok) {
          return failure("ACCESS_CHECK_CLEANUP_FAILED");
        }

        return {
          ok: true,
          observation,
        };
      } finally {
        disposeAbortClose?.();
      }
    } catch (error) {
      if (error instanceof AccessCheckLeaseExpiryTooCloseError) {
        return failure("ACCESS_CHECK_LEASE_EXPIRY_TOO_CLOSE");
      }

      if (error instanceof AccessCheckLeaseExpiryInvalidError) {
        return failure("ACCESS_CHECK_LEASE_EXPIRY_INVALID");
      }

      if (isAbortLikeError(error, input.abortSignal)) {
        return failure("ACCESS_CHECK_ABORTED");
      }

      if (error instanceof AccessCheckTimeoutError) {
        return failure("ACCESS_CHECK_TIMEOUT");
      }

      return failure("ACCESS_CHECK_BROWSER_FAILED");
    } finally {
      if (session !== undefined) {
        await runCleanupPhase(() => session?.close(), safeDeadlineAt, this.now);
      }

      if (leaseId !== undefined && releaseResult === undefined) {
        await releaseLeaseSafely(
          this.profileManager,
          leasedProfileId,
          leaseId,
          safeDeadlineAt,
          this.now,
        );
      }
    }
  }

  private getRequiredSafeDeadlineAt(leaseExpiresAt: string | undefined): number {
    if (leaseExpiresAt === undefined) {
      throw new AccessCheckLeaseExpiryInvalidError();
    }

    const expiresMs = Date.parse(leaseExpiresAt);
    if (!Number.isFinite(expiresMs)) {
      throw new AccessCheckLeaseExpiryInvalidError();
    }

    return expiresMs - this.leaseShutdownMarginMs;
  }

  private getNavigationTimeoutMs(safeDeadlineAt: number | undefined): number {
    if (safeDeadlineAt === undefined) {
      return this.navigationTimeoutMs;
    }

    const availableMs = safeDeadlineAt - this.now().getTime();

    if (availableMs <= 0) {
      throw new AccessCheckTimeoutError();
    }

    if (availableMs < MIN_SAFE_PHASE_TIMEOUT_MS) {
      throw new AccessCheckTimeoutError();
    }

    return Math.min(this.navigationTimeoutMs, availableMs);
  }
}

function failure(
  code: string,
): Extract<ProfileSourceAccessBrowserCheckResult, { readonly ok: false }> {
  return {
    ok: false,
    failureReason: {
      code,
      message: "Profile-source access browser check failed.",
    },
  };
}

type CleanupFailureCode = "FAILED" | "TIMEOUT";

async function releaseLeaseSafely(
  profileManager: ProfileSourceAccessBrowserProfileManagerPort,
  profileId: string | undefined,
  leaseId: string,
  safeDeadlineAt: number | undefined,
  now: () => Date,
): Promise<ProfileLeaseReleaseResult> {
  if (profileId === undefined) {
    return {
      ok: false,
      errorCode: "PROFILE_LEASE_RELEASE_FAILED",
      errorMessage: "Profile lease release failed.",
    };
  }

  const result = await runCleanupPhase(
    () =>
      profileManager.releaseProfileLease({
        profileId,
        leaseId,
      }),
    safeDeadlineAt,
    now,
  );

  if (result.ok && result.value !== undefined) {
    return result.value;
  }

  return {
    ok: false,
    errorCode: "PROFILE_LEASE_RELEASE_FAILED",
    errorMessage: "Profile lease release failed.",
  };
}

function assertSafeDeadlineReady(
  safeDeadlineAt: number | undefined,
  now: Date,
): void {
  if (safeDeadlineAt === undefined) {
    return;
  }

  if (safeDeadlineAt - now.getTime() < MIN_SAFE_PHASE_TIMEOUT_MS) {
    throw new AccessCheckLeaseExpiryTooCloseError();
  }
}

async function runBoundedPhase<T>(
  operation: () => Promise<T>,
  safeDeadlineAt: number | undefined,
  now: () => Date,
  abortSignal: AbortSignal | undefined,
  onLateResolve?: (value: T) => Promise<void>,
): Promise<T> {
  throwIfAborted(abortSignal);

  const timeoutMs = getRemainingTimeoutMs(safeDeadlineAt, now);
  let raceFinished = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const operationPromise = operation();

  operationPromise.then(
    (value) => {
      if (raceFinished && onLateResolve !== undefined) {
        runDetachedCleanup(() => onLateResolve(value));
      }
    },
    () => {},
  );

  try {
    return await Promise.race([
      operationPromise,
      new Promise<T>((_resolve, reject) => {
        if (timeoutMs !== undefined) {
          timeout = setTimeout(
            () => reject(new AccessCheckTimeoutError()),
            toTimerDelayMs(timeoutMs),
          );
        }

        if (abortSignal !== undefined) {
          onAbort = () => {
            reject(new AccessCheckAbortedError());
          };
          abortSignal.addEventListener("abort", onAbort, { once: true });
        }
      }),
    ]);
  } finally {
    raceFinished = true;
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    if (onAbort !== undefined) {
      abortSignal?.removeEventListener("abort", onAbort);
    }
  }
}

async function runCleanupPhase<T>(
  operation: () => Promise<T | undefined> | undefined,
  safeDeadlineAt: number | undefined,
  now: () => Date,
): Promise<
  | { readonly ok: true; readonly value: T | undefined }
  | { readonly ok: false; readonly code: CleanupFailureCode }
> {
  try {
    const timeoutMs =
      safeDeadlineAt === undefined ? undefined : safeDeadlineAt - now().getTime();
    const operationPromise = Promise.resolve(operation());
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const value = await Promise.race([
      operationPromise,
      new Promise<T | undefined>((_resolve, reject) => {
        if (timeoutMs !== undefined) {
          timeout = setTimeout(
            () => reject(new AccessCheckTimeoutError()),
            toTimerDelayMs(timeoutMs),
          );
        }
      }),
    ]).finally(() => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    });

    return {
      ok: true,
      value,
    };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof AccessCheckTimeoutError ? "TIMEOUT" : "FAILED",
    };
  }
}

function getRemainingTimeoutMs(
  safeDeadlineAt: number | undefined,
  now: () => Date,
): number | undefined {
  if (safeDeadlineAt === undefined) {
    return undefined;
  }

  const remainingMs = safeDeadlineAt - now().getTime();

  if (remainingMs <= 0) {
    throw new AccessCheckTimeoutError();
  }

  return remainingMs;
}

function toTimerDelayMs(timeoutMs: number): number {
  return Math.min(Math.max(0, timeoutMs), MAX_TIMER_DELAY_MS);
}

function createAbortCloseListener(
  abortSignal: AbortSignal | undefined,
  session: BrowserProviderSession,
): (() => void) | undefined {
  if (abortSignal === undefined) {
    return undefined;
  }

  const onAbort = (): void => {
    runDetachedCleanup(() => session.close());
  };

  abortSignal.addEventListener("abort", onAbort, { once: true });

  return () => {
    abortSignal.removeEventListener("abort", onAbort);
  };
}

function runDetachedCleanup(operation: () => Promise<unknown> | undefined): void {
  void Promise.resolve()
    .then(operation)
    .catch(() => {});
}

function throwIfAborted(abortSignal: AbortSignal | undefined): void {
  if (abortSignal?.aborted === true) {
    throw new AccessCheckAbortedError();
  }
}

function isAbortLikeError(
  error: unknown,
  abortSignal: AbortSignal | undefined,
): boolean {
  return (
    abortSignal?.aborted === true ||
    error instanceof AccessCheckAbortedError ||
    (error instanceof Error && error.name === "AbortError")
  );
}

class AccessCheckLeaseExpiryTooCloseError extends Error {
  public constructor() {
    super("Profile-source access lease expiry is too close.");
    this.name = "AccessCheckLeaseExpiryTooCloseError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class AccessCheckLeaseExpiryInvalidError extends Error {
  public constructor() {
    super("Profile-source access lease expiry is invalid.");
    this.name = "AccessCheckLeaseExpiryInvalidError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class AccessCheckTimeoutError extends Error {
  public constructor() {
    super("Profile-source access browser check timed out.");
    this.name = "AccessCheckTimeoutError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class AccessCheckAbortedError extends Error {
  public constructor() {
    super("Profile-source access browser check was aborted.");
    this.name = "AccessCheckAbortedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const PROFILE_SOURCE_ACCESS_OBSERVATION_SCRIPT = `(() => {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim().toLowerCase();
  const isFacebook = hostname === "facebook.com" || hostname.endsWith(".facebook.com");
  const main = document.querySelector("[role='main']") || document.body;
  const scopedText = (root) => normalize(root?.innerText || root?.textContent || "");
  const mainText = scopedText(main);
  const hasScopedText = (values) => values.some((value) => mainText.includes(value));
  const controls = Array.from(
    document.querySelectorAll("button, a[role='button'], [role='button'], [aria-label]")
  );
  const controlText = (element) => normalize(
    [
      element.getAttribute("aria-label"),
      element.innerText,
      element.textContent
    ].filter(Boolean).join(" ")
  );
  const hasControl = (values) =>
    controls.some((element) => values.some((value) => controlText(element) === value));
  const hasControlContaining = (values) =>
    controls.some((element) => values.some((value) => controlText(element).includes(value)));
  const pageKind = (() => {
    if (!isFacebook) return "OTHER";
    if (hasScopedText(["content isn't available", "this content isn't available", "page isn't available"])) {
      return "FACEBOOK_UNAVAILABLE";
    }
    if (pathname.includes("/groups/")) return "FACEBOOK_GROUP";
    return "OTHER";
  })();

  const groupContentVisible =
    pageKind === "FACEBOOK_GROUP" &&
    Boolean(document.querySelector("[role='main'], [role='feed'], a[href*='/groups/']"));
  const joinActionVisible = hasControl(["join group", "join this group"]);
  const joinedIndicatorVisible = hasControlContaining(["joined", "member of this group", "leave group"]);
  const accessDeniedIndicatorVisible = hasScopedText([
    "you can't access this group",
    "you cannot access this group",
    "this content isn't available",
    "content isn't available",
    "page isn't available",
    "this group isn't available",
    "this group is unavailable"
  ]);

  return {
    pageKind,
    groupContentVisible,
    joinActionVisible,
    joinedIndicatorVisible,
    accessDeniedIndicatorVisible
  };
})()`;

function toBlockingObservation(
  blockingState: FacebookPageBlockingState,
): ProfileSourceAccessBrowserObservation | undefined {
  if (blockingState === "CHECKPOINT_REQUIRED") {
    return {
      pageKind: "FACEBOOK_CHECKPOINT",
      groupContentVisible: false,
      joinActionVisible: false,
      joinedIndicatorVisible: false,
      accessDeniedIndicatorVisible: false,
    };
  }

  if (blockingState === "LOGIN_REQUIRED") {
    return {
      pageKind: "FACEBOOK_LOGIN",
      groupContentVisible: false,
      joinActionVisible: false,
      joinedIndicatorVisible: false,
      accessDeniedIndicatorVisible: false,
    };
  }

  return undefined;
}
