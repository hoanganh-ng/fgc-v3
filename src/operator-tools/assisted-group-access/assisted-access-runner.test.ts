import { describe, expect, it } from "vitest";
import type {
  BrowserProviderLaunchConfig,
  BrowserProviderNavigationInput,
  BrowserProviderNavigationResult,
  BrowserProviderPage,
  BrowserProviderPort,
  BrowserProviderResponse,
  BrowserProviderSession,
  ProfileLeaseReleaseInput,
  ProfileLeaseReleaseResult,
  RuntimeProfileConfigurationResult,
  SourceGroupLookupResult,
  SourceGroupLookupSourceGroup,
} from "../../collector-runtime/application";
import type { ProfileAssistedGroupAccessCheckoutResult } from "../../collector-runtime/infrastructure";
import {
  runAssistedAccessCommand,
  selectEntryRoute,
  type AssistedAccessContentManagerPort,
  type AssistedAccessDependencies,
  type AssistedAccessProfileManagerPort,
  type AssistedAccessSessionControlPort,
} from "./assisted-access-runner";
import type { AssistedGroupAccessCliArgs } from "./cli-args";

const now = "2026-05-01T10:00:00.000Z";

describe("assisted access runner", () => {
  it("checks out, opens the selected default route, waits for the operator, closes, and releases", async () => {
    const context = createTestContext();

    const result = await runAssistedAccessCommand({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(now),
    });

    expect(result).toMatchObject({
      ok: true,
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      leaseId: "lease-1",
      selectedRoute: {
        id: "route-1",
        type: "DIRECT_GROUP_URL",
        riskLevel: "MEDIUM",
      },
      pageLoaded: true,
      completionReason: "OPERATOR_COMPLETED",
      leaseReleased: true,
    });
    expect(context.profileManager.checkoutCalls).toEqual([
      {
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      },
    ]);
    expect(context.profileManager.runtimeConfigurationLeaseIds).toEqual([
      "lease-1",
    ]);
    expect(context.browserProvider.launchCalls[0]).toMatchObject({
      providerName: "PLAYWRIGHT_CHROMIUM",
      profileId: "profile-1",
      leaseId: "lease-1",
      headless: false,
    });
    expect(context.page.gotoCalls).toEqual([
      {
        url: "https://www.facebook.com/groups/group-1",
        waitUntil: "domcontentloaded",
        timeoutMs: 30_000,
      },
    ]);
    expect(context.profileManager.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
        macroActionsPerformed: 0,
      },
    ]);
  });

  it("derives a direct route from source group URL when no default route exists", () => {
    const result = selectEntryRoute({
      sourceGroup: {
        id: "source-group-1",
        platform: "FACEBOOK",
        status: "ACTIVE",
        url: "https://www.facebook.com/groups/group-1",
        entryRoutes: [],
      },
      allowHighRiskRoute: false,
    });

    expect(result).toEqual({
      ok: true,
      route: {
        id: "derived-direct-group-url",
        type: "DIRECT_GROUP_URL",
        url: "https://www.facebook.com/groups/group-1",
        riskLevel: "MEDIUM",
        isDefault: true,
        derived: true,
      },
    });
  });

  it("rejects unsafe route-selection cases", () => {
    const activeSourceGroup = createSourceGroup();

    expect(
      selectEntryRoute({
        sourceGroup: {
          ...activeSourceGroup,
          platform: "INSTAGRAM",
        },
        allowHighRiskRoute: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "SOURCE_GROUP_PLATFORM_NOT_SUPPORTED" } });
    expect(
      selectEntryRoute({
        sourceGroup: {
          ...activeSourceGroup,
          status: "PAUSED",
        },
        allowHighRiskRoute: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "SOURCE_GROUP_NOT_ACTIVE" } });
    expect(
      selectEntryRoute({
        sourceGroup: activeSourceGroup,
        explicitEntryRouteId: "missing",
        allowHighRiskRoute: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "ENTRY_ROUTE_NOT_FOUND" } });
    expect(
      selectEntryRoute({
        sourceGroup: {
          ...activeSourceGroup,
          entryRoutes: [
            ...(activeSourceGroup.entryRoutes ?? []),
            {
              id: "route-2",
              type: "CATEGORY_URL",
              url: "https://www.facebook.com/groups/feed",
              riskLevel: "LOW",
              isDefault: true,
            },
          ],
        },
        allowHighRiskRoute: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "MULTIPLE_DEFAULT_ENTRY_ROUTES" } });
    expect(
      selectEntryRoute({
        sourceGroup: {
          ...activeSourceGroup,
          entryRoutes: [
            {
              id: "route-1",
              type: "DIRECT_GROUP_URL",
              url: "file:///tmp/group",
              riskLevel: "MEDIUM",
              isDefault: true,
            },
          ],
        },
        allowHighRiskRoute: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "ENTRY_ROUTE_URL_INVALID" } });
    expect(
      selectEntryRoute({
        sourceGroup: {
          ...activeSourceGroup,
          entryRoutes: [
            {
              id: "route-1",
              type: "DIRECT_GROUP_URL",
              url: "https://www.facebook.com/groups/group-1",
              riskLevel: "HIGH",
              isDefault: true,
            },
          ],
        },
        allowHighRiskRoute: false,
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "HIGH_RISK_ENTRY_ROUTE_REQUIRES_FLAG" },
    });
  });

  it("allows high-risk routes only with the explicit flag", () => {
    const result = selectEntryRoute({
      sourceGroup: {
        ...createSourceGroup(),
        entryRoutes: [
          {
            id: "route-1",
            type: "DIRECT_GROUP_URL",
            url: "https://www.facebook.com/groups/group-1",
            riskLevel: "HIGH",
            isDefault: true,
          },
        ],
      },
      allowHighRiskRoute: true,
    });

    expect(result).toMatchObject({
      ok: true,
      route: {
        id: "route-1",
        riskLevel: "HIGH",
      },
    });
  });

  it("clamps operator wait before lease expiry", async () => {
    const context = createTestContext({
      leaseExpiresAt: "2026-05-01T10:01:00.000Z",
    });

    await runAssistedAccessCommand({
      args: createArgs({ maxDurationMs: 600_000 }),
      dependencies: context.dependencies,
      now: () => new Date(now),
    });

    expect(context.sessionControl.calls).toEqual([
      {
        maxDurationMs: 55_000,
      },
    ]);
  });

  it("deducts browser launch and navigation time from operator wait", async () => {
    const clock = new MutableClock(now);
    const context = createTestContext({
      clock,
      leaseExpiresAt: "2026-05-01T10:01:00.000Z",
      launchDurationMs: 10_000,
      navigationDurationMs: 15_000,
    });

    const result = await runAssistedAccessCommand({
      args: createArgs({ maxDurationMs: 600_000 }),
      dependencies: context.dependencies,
      now: () => clock.now(),
    });

    expect(result.ok).toBe(true);
    expect(context.page.gotoCalls).toEqual([
      {
        url: "https://www.facebook.com/groups/group-1",
        waitUntil: "domcontentloaded",
        timeoutMs: 30_000,
      },
    ]);
    expect(context.sessionControl.calls).toEqual([
      {
        maxDurationMs: 30_000,
      },
    ]);
  });

  it("does not wait for operator completion when navigation consumes all remaining time", async () => {
    const clock = new MutableClock(now);
    const context = createTestContext({
      clock,
      leaseExpiresAt: "2026-05-01T10:00:30.000Z",
      launchDurationMs: 10_000,
      navigationDurationMs: 15_000,
    });

    const result = await runAssistedAccessCommand({
      args: createArgs({ maxDurationMs: 600_000 }),
      dependencies: context.dependencies,
      now: () => clock.now(),
    });

    expect(result).toMatchObject({
      ok: false,
      pageLoaded: true,
      leaseReleased: true,
      errors: [
        {
          code: "LEASE_EXPIRY_TOO_CLOSE",
        },
      ],
    });
    expect(context.page.gotoCalls).toEqual([
      {
        url: "https://www.facebook.com/groups/group-1",
        waitUntil: "domcontentloaded",
        timeoutMs: 15_000,
      },
    ]);
    expect(context.sessionControl.calls).toEqual([]);
  });

  it("uses requested duration when it is shorter than the lease duration", async () => {
    const clock = new MutableClock(now);
    const context = createTestContext({
      clock,
      leaseExpiresAt: "2026-05-01T10:45:00.000Z",
      launchDurationMs: 5_000,
      navigationDurationMs: 5_000,
    });

    await runAssistedAccessCommand({
      args: createArgs({ maxDurationMs: 40_000 }),
      dependencies: context.dependencies,
      now: () => clock.now(),
    });

    expect(context.sessionControl.calls).toEqual([
      {
        maxDurationMs: 30_000,
      },
    ]);
  });

  it.each([
    { name: "missing", leaseExpiresAt: undefined },
    { name: "invalid", leaseExpiresAt: "not-a-date" },
  ])(
    "uses requested duration when lease expiry is $name",
    async ({ leaseExpiresAt }) => {
      const clock = new MutableClock(now);
      const context = createTestContext({
        clock,
        leaseExpiresAt,
        launchDurationMs: 5_000,
        navigationDurationMs: 5_000,
      });

      await runAssistedAccessCommand({
        args: createArgs({ maxDurationMs: 40_000 }),
        dependencies: context.dependencies,
        now: () => clock.now(),
      });

      expect(context.sessionControl.calls).toEqual([
        {
          maxDurationMs: 30_000,
        },
      ]);
    },
  );

  it("attempts lease release when browser close fails", async () => {
    const context = createTestContext({ closeFails: true });

    const result = await runAssistedAccessCommand({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(now),
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          code: "BROWSER_SESSION_CLOSE_FAILED",
          message: "Browser session close failed after assisted access.",
        },
      ],
    });
    expect(result.leaseReleased).toBe(true);
    expect(context.session.closed).toBe(true);
    expect(context.profileManager.releaseCalls).toHaveLength(1);
  });

  it("reports aborted sessions after cleanup", async () => {
    const context = createTestContext({ completionReason: "ABORTED" });

    const result = await runAssistedAccessCommand({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(now),
    });

    expect(result).toMatchObject({
      ok: false,
      completionReason: "ABORTED",
      leaseReleased: true,
      errors: [
        {
          code: "OPERATOR_SESSION_ABORTED",
        },
      ],
    });
  });
});

interface TestContext {
  readonly contentManager: FakeContentManager;
  readonly profileManager: FakeProfileManager;
  readonly browserProvider: FakeBrowserProvider;
  readonly sessionControl: FakeSessionControl;
  readonly session: FakeBrowserSession;
  readonly page: FakeBrowserPage;
  readonly dependencies: AssistedAccessDependencies;
}

function createTestContext(
  options: {
    readonly leaseExpiresAt?: string | undefined;
    readonly closeFails?: boolean;
    readonly completionReason?: "OPERATOR_COMPLETED" | "TIMEOUT" | "ABORTED";
    readonly clock?: MutableClock;
    readonly launchDurationMs?: number;
    readonly navigationDurationMs?: number;
  } = {},
): TestContext {
  const contentManager = new FakeContentManager();
  const profileManager = new FakeProfileManager(
    "leaseExpiresAt" in options
      ? options.leaseExpiresAt
      : "2026-05-01T10:45:00.000Z",
  );
  const page = new FakeBrowserPage(
    options.clock,
    options.navigationDurationMs ?? 0,
  );
  const session = new FakeBrowserSession(page, options.closeFails === true);
  const browserProvider = new FakeBrowserProvider(
    session,
    options.clock,
    options.launchDurationMs ?? 0,
  );
  const sessionControl = new FakeSessionControl(
    options.completionReason ?? "OPERATOR_COMPLETED",
  );

  return {
    contentManager,
    profileManager,
    browserProvider,
    sessionControl,
    session,
    page,
    dependencies: {
      contentManager,
      profileManager,
      browserProvider,
      sessionControl,
      close: async () => {},
    },
  };
}

function createArgs(
  overrides: Partial<AssistedGroupAccessCliArgs> = {},
): AssistedGroupAccessCliArgs {
  return {
    profileId: "profile-1",
    sourceGroupId: "source-group-1",
    baseUrl: "http://localhost:8081",
    browserProvider: "playwright",
    maxDurationMs: 600_000,
    allowHighRiskRoute: false,
    ...overrides,
  };
}

function createSourceGroup(): SourceGroupLookupSourceGroup {
  return {
    id: "source-group-1",
    platform: "FACEBOOK",
    status: "ACTIVE",
    url: "https://www.facebook.com/groups/group-1",
    entryRoutes: [
      {
        id: "route-1",
        type: "DIRECT_GROUP_URL",
        url: "https://www.facebook.com/groups/group-1",
        riskLevel: "MEDIUM",
        isDefault: true,
      },
    ],
  };
}

class FakeContentManager implements AssistedAccessContentManagerPort {
  public async getSourceGroup(): Promise<SourceGroupLookupResult> {
    return {
      ok: true,
      sourceGroup: createSourceGroup(),
    };
  }
}

class FakeProfileManager implements AssistedAccessProfileManagerPort {
  public readonly checkoutCalls: Array<{
    readonly profileId: string;
    readonly sourceGroupId: string;
  }> = [];
  public readonly runtimeConfigurationLeaseIds: string[] = [];
  public readonly releaseCalls: ProfileLeaseReleaseInput[] = [];

  public constructor(private readonly leaseExpiresAt: string | undefined) {}

  public async checkoutProfileForAssistedGroupAccess(
    profileId: string,
    sourceGroupId: string,
  ): Promise<ProfileAssistedGroupAccessCheckoutResult> {
    this.checkoutCalls.push({ profileId, sourceGroupId });

    return {
      ok: true,
      profileId,
      accountStage: "WARMING",
      leaseId: "lease-1",
      ...(this.leaseExpiresAt !== undefined
        ? { leaseExpiresAt: this.leaseExpiresAt }
        : {}),
    };
  }

  public async getRuntimeProfileConfiguration(
    leaseId: string,
  ): Promise<RuntimeProfileConfigurationResult> {
    this.runtimeConfigurationLeaseIds.push(leaseId);

    return {
      ok: true,
      configuration: {
        profileId: "profile-1",
        leaseId,
        leaseExpiresAt: this.leaseExpiresAt ?? "2026-05-01T10:45:00.000Z",
        hardwareFingerprint: {
          userAgent: "Mozilla/5.0 Test",
          viewport: {
            width: 1280,
            height: 720,
          },
          languages: ["en-US", "en"],
          timezone: "America/Los_Angeles",
        },
        networkContext: {
          proxy: null,
          killswitch: {
            enabled: true,
          },
        },
        authenticationState: {
          cookies: [],
          localStorage: [],
        },
        temporalRoutine: {
          timezone: "America/Los_Angeles",
        },
      },
    };
  }

  public async releaseProfileLease(
    input: ProfileLeaseReleaseInput,
  ): Promise<ProfileLeaseReleaseResult> {
    this.releaseCalls.push(input);

    return {
      ok: true,
      releasedAt: "2026-05-01T10:01:00.000Z",
    };
  }
}

class FakeBrowserProvider implements BrowserProviderPort {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public readonly launchCalls: BrowserProviderLaunchConfig[] = [];

  public constructor(
    private readonly session: FakeBrowserSession,
    private readonly clock: MutableClock | undefined,
    private readonly launchDurationMs: number,
  ) {}

  public async launch(
    config: BrowserProviderLaunchConfig,
  ): Promise<BrowserProviderSession> {
    this.launchCalls.push(config);
    this.clock?.advance(this.launchDurationMs);

    return this.session;
  }
}

class FakeBrowserSession implements BrowserProviderSession {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public closed = false;

  public constructor(
    private readonly page: FakeBrowserPage,
    private readonly closeFails: boolean,
  ) {}

  public async newPage(): Promise<BrowserProviderPage> {
    return this.page;
  }

  public async close(): Promise<void> {
    this.closed = true;

    if (this.closeFails) {
      throw new Error("close failed");
    }
  }
}

class FakeBrowserPage implements BrowserProviderPage {
  public readonly gotoCalls: BrowserProviderNavigationInput[] = [];
  private currentUrl = "about:blank";

  public constructor(
    private readonly clock: MutableClock | undefined,
    private readonly navigationDurationMs: number,
  ) {}

  public url(): string {
    return this.currentUrl;
  }

  public async goto(
    input: BrowserProviderNavigationInput,
  ): Promise<BrowserProviderNavigationResult | null> {
    this.gotoCalls.push(input);
    this.currentUrl = input.url;
    this.clock?.advance(this.navigationDurationMs);

    return { status: 200 };
  }

  public async evaluate<T = unknown>(): Promise<T> {
    return undefined as T;
  }

  public async exposeBinding(): Promise<void> {}

  public async addInitScript(): Promise<void> {}

  public onResponse(_listener: (response: BrowserProviderResponse) => void): void {}

  public oncePageError(_listener: (error: Error) => void): void {}

  public offPageError(_listener: (error: Error) => void): void {}

  public onceCrash(_listener: () => void): void {}

  public offCrash(_listener: () => void): void {}
}

class FakeSessionControl implements AssistedAccessSessionControlPort {
  public readonly calls: Array<{
    readonly maxDurationMs: number;
  }> = [];

  public constructor(
    private readonly completionReason: "OPERATOR_COMPLETED" | "TIMEOUT" | "ABORTED",
  ) {}

  public async waitForCompletion(input: {
    readonly maxDurationMs: number;
  }): Promise<"OPERATOR_COMPLETED" | "TIMEOUT" | "ABORTED"> {
    this.calls.push({
      maxDurationMs: input.maxDurationMs,
    });

    return this.completionReason;
  }
}

class MutableClock {
  private valueMs: number;

  public constructor(value: string) {
    this.valueMs = new Date(value).getTime();
  }

  public now(): Date {
    return new Date(this.valueMs);
  }

  public advance(durationMs: number): void {
    this.valueMs += durationMs;
  }
}
