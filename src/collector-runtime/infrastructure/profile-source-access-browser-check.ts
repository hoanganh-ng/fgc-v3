import { z } from "zod";
import type {
  BrowserProviderPort,
  BrowserProviderSession,
  ProfileLeaseReleaseResult,
  RuntimeProfileConfigurationResult,
} from "../application";
import type {
  ProfileSourceAccessBrowserCheckInput,
  ProfileSourceAccessBrowserCheckPort,
  ProfileSourceAccessBrowserCheckResult,
  ProfileSourceAccessBrowserObservation,
} from "../application/ports/profile-source-access-check-execution.port";
import { buildBrowserProviderLaunchConfig } from "./browser-providers/browser-provider-launch-config";
import type { ProfileAssistedGroupAccessCheckoutResult } from "./profile-manager-http-client";

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
const MIN_NAVIGATION_TIMEOUT_MS = 1_000;

const BrowserObservationSchema = z
  .object({
    pageKind: z.enum([
      "FACEBOOK_GROUP",
      "FACEBOOK_LOGIN",
      "FACEBOOK_CHECKPOINT",
      "FACEBOOK_UNAVAILABLE",
      "OTHER",
    ]),
    groupContentVisible: z.boolean(),
    joinActionVisible: z.boolean(),
    joinedIndicatorVisible: z.boolean(),
    accessDeniedIndicatorVisible: z.boolean(),
  })
  .strict();

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
    let session: BrowserProviderSession | undefined;
    let closeFailed = false;
    let releaseResult: ProfileLeaseReleaseResult | undefined;

    try {
      const checkoutResult =
        await this.profileManager.checkoutProfileForAssistedGroupAccess(
          input.profileId,
          input.sourceGroupId,
        );

      if (!checkoutResult.ok) {
        return failure("ACCESS_CHECK_CHECKOUT_FAILED");
      }

      if (checkoutResult.profileId !== input.profileId) {
        return failure("ACCESS_CHECK_PROFILE_ID_MISMATCH");
      }

      leaseId = checkoutResult.leaseId;
      const runtimeConfigurationResult =
        await this.profileManager.getRuntimeProfileConfiguration(leaseId);

      if (!runtimeConfigurationResult.ok) {
        return failure("ACCESS_CHECK_RUNTIME_CONFIGURATION_FAILED");
      }

      if (runtimeConfigurationResult.configuration.profileId !== input.profileId) {
        return failure("ACCESS_CHECK_RUNTIME_PROFILE_ID_MISMATCH");
      }

      const launchConfig = buildBrowserProviderLaunchConfig({
        providerName: this.browserProvider.providerName,
        configuration: runtimeConfigurationResult.configuration,
        headless: true,
      });

      session = await this.browserProvider.launch(launchConfig);
      const page = await session.newPage();
      await page.goto({
        url: input.target.url,
        waitUntil: "domcontentloaded",
        timeoutMs: this.getNavigationTimeoutMs(checkoutResult.leaseExpiresAt),
      });

      const observation = BrowserObservationSchema.parse(
        await page.evaluate<unknown>(PROFILE_SOURCE_ACCESS_OBSERVATION_SCRIPT),
      );

      try {
        await session.close();
        session = undefined;
      } catch {
        closeFailed = true;
      }

      releaseResult = await this.profileManager.releaseProfileLease({
        profileId: input.profileId,
        leaseId,
      });

      if (closeFailed || !releaseResult.ok) {
        return failure("ACCESS_CHECK_CLEANUP_FAILED");
      }

      return {
        ok: true,
        observation,
      };
    } catch {
      return failure("ACCESS_CHECK_BROWSER_FAILED");
    } finally {
      if (session !== undefined) {
        try {
          await session.close();
        } catch {
          closeFailed = true;
        }
      }

      if (leaseId !== undefined && releaseResult === undefined) {
        try {
          releaseResult = await this.profileManager.releaseProfileLease({
            profileId: input.profileId,
            leaseId,
          });
        } catch {
          releaseResult = {
            ok: false,
            errorCode: "PROFILE_LEASE_RELEASE_FAILED",
            errorMessage: "Profile lease release failed.",
          };
        }
      }
    }
  }

  private getNavigationTimeoutMs(leaseExpiresAt: string | undefined): number {
    if (leaseExpiresAt === undefined) {
      return this.navigationTimeoutMs;
    }

    const expiresMs = Date.parse(leaseExpiresAt);
    if (!Number.isFinite(expiresMs)) {
      return this.navigationTimeoutMs;
    }

    const availableMs =
      expiresMs - this.now().getTime() - this.leaseShutdownMarginMs;

    if (availableMs < MIN_NAVIGATION_TIMEOUT_MS) {
      return MIN_NAVIGATION_TIMEOUT_MS;
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

const PROFILE_SOURCE_ACCESS_OBSERVATION_SCRIPT = `(() => {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const bodyText = (document.body?.innerText || "").toLowerCase();
  const isFacebook = hostname === "facebook.com" || hostname.endsWith(".facebook.com");
  const hasAny = (values) => values.some((value) => bodyText.includes(value));
  const pageKind = (() => {
    if (!isFacebook) return "OTHER";
    if (pathname.includes("/checkpoint") || hasAny(["checkpoint", "security check"])) {
      return "FACEBOOK_CHECKPOINT";
    }
    if (pathname.includes("/login") || hasAny(["log in to facebook", "you must log in"])) {
      return "FACEBOOK_LOGIN";
    }
    if (hasAny(["content isn't available", "this content isn't available", "page isn't available"])) {
      return "FACEBOOK_UNAVAILABLE";
    }
    if (pathname.includes("/groups/")) return "FACEBOOK_GROUP";
    return "OTHER";
  })();

  const groupContentVisible =
    pageKind === "FACEBOOK_GROUP" &&
    Boolean(document.querySelector("[role='main'], [role='feed'], a[href*='/groups/']"));
  const joinActionVisible = hasAny(["join group", "join this group"]);
  const joinedIndicatorVisible = hasAny(["joined", "member of this group", "leave group"]);
  const accessDeniedIndicatorVisible = hasAny([
    "private group",
    "you can't access this group",
    "this content isn't available",
    "content isn't available",
    "page isn't available"
  ]);

  return {
    pageKind,
    groupContentVisible,
    joinActionVisible,
    joinedIndicatorVisible,
    accessDeniedIndicatorVisible
  };
})()`;
