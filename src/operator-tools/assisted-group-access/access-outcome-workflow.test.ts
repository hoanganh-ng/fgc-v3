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
} from "../../collector-runtime/application";
import type {
  ProfileAssistedGroupAccessCheckoutResult,
  ProfileSourceAccessReportableState,
  UpsertProfileSourceAccessResult,
} from "../../collector-runtime/infrastructure";
import type { AssistedGroupAccessCliArgs } from "./cli-args";
import type {
  AssistedAccessContentManagerPort,
  AssistedAccessDependencies,
  AssistedAccessProfileManagerPort,
  AssistedAccessSessionControlPort,
} from "./assisted-access-runner";
import {
  createProfileSourceAccessOutcomeRequest,
  parseAssistedAccessOutcomeSelection,
  promptForAssistedAccessOutcome,
  runAssistedAccessWorkflow,
  type AssistedAccessOutcomePromptPort,
  type AssistedAccessOutcomeSelection,
  type ProfileSourceAccessOutcomeReporterPort,
} from "./access-outcome-workflow";

const now = "2026-05-01T10:00:00.000Z";

describe("assisted access outcome workflow", () => {
  it.each([
    ["1", "PUBLIC_ACCESSIBLE"],
    ["2", "JOIN_REQUIRED"],
    ["3", "JOINED_ACCESSIBLE"],
    ["4", "ACCESS_DENIED"],
    ["5", "LOGIN_REQUIRED"],
    ["6", "CHECKPOINT_REQUIRED"],
    ["S", "SKIP"],
  ] as const)("parses menu choice %s", (input, expected) => {
    expect(parseAssistedAccessOutcomeSelection(input)).toBe(expected);
  });

  it("parses exact and case-insensitive state input", () => {
    expect(parseAssistedAccessOutcomeSelection("JOIN_REQUIRED")).toBe(
      "JOIN_REQUIRED",
    );
    expect(parseAssistedAccessOutcomeSelection(" joined_accessible ")).toBe(
      "JOINED_ACCESSIBLE",
    );
  });

  it("re-prompts invalid input and treats EOF as skip", async () => {
    const lines = ["not-valid", "access_denied"];
    const writes: string[] = [];

    await expect(
      promptForAssistedAccessOutcome({
        writeLine: (message) => writes.push(message),
        readLine: async () => lines.shift(),
      }),
    ).resolves.toBe("ACCESS_DENIED");
    expect(writes).toContain("Invalid selection. Choose a number, state name, or S.");

    await expect(
      promptForAssistedAccessOutcome({
        writeLine() {},
        readLine: async () => undefined,
      }),
    ).resolves.toBe("SKIP");
  });

  it("maps successful outcomes to explicit null failure reason", () => {
    expect(createProfileSourceAccessOutcomeRequest("PUBLIC_ACCESSIBLE")).toEqual({
      accessState: "PUBLIC_ACCESSIBLE",
      lastFailureReason: null,
    });
    expect(createProfileSourceAccessOutcomeRequest("JOINED_ACCESSIBLE")).toEqual({
      accessState: "JOINED_ACCESSIBLE",
      lastFailureReason: null,
    });
  });

  it.each([
    [
      "JOIN_REQUIRED",
      "Operator observed that group membership is required.",
    ],
    ["ACCESS_DENIED", "Operator observed that access was denied."],
    ["LOGIN_REQUIRED", "Operator observed that login is required."],
    [
      "CHECKPOINT_REQUIRED",
      "Operator observed that a checkpoint is required.",
    ],
  ] as const)("maps %s to a deterministic failure reason", (outcome, message) => {
    expect(createProfileSourceAccessOutcomeRequest(outcome)).toEqual({
      accessState: outcome,
      lastFailureReason: {
        code: outcome,
        message,
      },
    });
  });

  it("prompts and reports after operator completion", async () => {
    const context = createWorkflowContext({
      promptSelection: "JOIN_REQUIRED",
    });

    const result = await runAssistedAccessWorkflow({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(now),
    });

    expect(result).toMatchObject({
      ok: true,
      reporting: {
        status: "SUCCEEDED",
        outcome: "JOIN_REQUIRED",
      },
    });
    expect(context.prompt.calls).toEqual([
      {
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      },
    ]);
    expect(context.reporter.calls).toEqual([
      {
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
        outcome: "JOIN_REQUIRED",
      },
    ]);
  });

  it.each([
    ["TIMEOUT", undefined],
    ["ABORTED", undefined],
    ["OPERATOR_COMPLETED", "navigation"],
  ] as const)(
    "does not prompt after %s session with %s failure",
    async (completionReason, failure) => {
      const context = createWorkflowContext({
        completionReason,
        navigationFails: failure === "navigation",
      });

      const result = await runAssistedAccessWorkflow({
        args: createArgs(),
        dependencies: context.dependencies,
        now: () => new Date(now),
      });

      expect(result.reporting.status).toBe("NOT_ELIGIBLE");
      expect(context.prompt.calls).toEqual([]);
      expect(context.reporter.calls).toEqual([]);
    },
  );

  it("prompts despite lease-release failure and preserves session failure", async () => {
    const context = createWorkflowContext({
      releaseFails: true,
      promptSelection: "LOGIN_REQUIRED",
    });

    const result = await runAssistedAccessWorkflow({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(now),
    });

    expect(result).toMatchObject({
      ok: false,
      reporting: {
        status: "SUCCEEDED",
        outcome: "LOGIN_REQUIRED",
      },
      errors: [
        {
          code: "PROFILE_LEASE_RELEASE_FAILED",
        },
      ],
    });
    expect(context.prompt.calls).toHaveLength(1);
    expect(context.reporter.calls).toHaveLength(1);
  });

  it("skips without mutating and preserves session exit behavior", async () => {
    const context = createWorkflowContext({
      releaseFails: true,
      promptSelection: "SKIP",
    });

    const result = await runAssistedAccessWorkflow({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(now),
    });

    expect(result.ok).toBe(false);
    expect(result.reporting.status).toBe("SKIPPED");
    expect(context.reporter.calls).toEqual([]);
  });

  it("reports persistence failure as a workflow failure", async () => {
    const context = createWorkflowContext({
      promptSelection: "CHECKPOINT_REQUIRED",
      reportResult: {
        ok: false,
        statusCode: 503,
        errorCode: "PROFILE_MANAGER_HTTP_ERROR",
        errorMessage: "Profile Manager responded with HTTP 503.",
      },
    });

    const result = await runAssistedAccessWorkflow({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(now),
    });

    expect(result).toMatchObject({
      ok: false,
      reporting: {
        status: "FAILED",
        outcome: "CHECKPOINT_REQUIRED",
        error: {
          code: "PROFILE_SOURCE_ACCESS_REPORT_FAILED",
          causeCode: "PROFILE_MANAGER_HTTP_ERROR",
          statusCode: 503,
        },
      },
    });
  });

  it("runs cleanup before prompting and reporting", async () => {
    const order: string[] = [];
    const context = createWorkflowContext({
      order,
      promptSelection: "PUBLIC_ACCESSIBLE",
    });

    await runAssistedAccessWorkflow({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(now),
    });

    expect(order).toEqual([
      "browser-close",
      "lease-release",
      "runner-close",
      "prompt",
      "report",
    ]);
  });
});

function createWorkflowContext(
  options: {
    readonly completionReason?: "OPERATOR_COMPLETED" | "TIMEOUT" | "ABORTED";
    readonly navigationFails?: boolean;
    readonly releaseFails?: boolean;
    readonly promptSelection?: AssistedAccessOutcomeSelection;
    readonly reportResult?: UpsertProfileSourceAccessResult;
    readonly order?: string[];
  } = {},
): {
  readonly prompt: FakeOutcomePrompt;
  readonly reporter: FakeOutcomeReporter;
  readonly dependencies: {
    readonly assistedAccess: AssistedAccessDependencies;
    readonly outcomePrompt: FakeOutcomePrompt;
    readonly outcomeReporter: FakeOutcomeReporter;
  };
} {
  const order = options.order;
  const prompt = new FakeOutcomePrompt(options.promptSelection ?? "ACCESS_DENIED", order);
  const reporter = new FakeOutcomeReporter(options.reportResult, order);
  const profileManager = new FakeProfileManager(options.releaseFails === true, order);
  const page = new FakeBrowserPage(options.navigationFails === true);
  const session = new FakeBrowserSession(page, order);
  const browserProvider = new FakeBrowserProvider(session);

  return {
    prompt,
    reporter,
    dependencies: {
      assistedAccess: {
        contentManager: new FakeContentManager(),
        profileManager,
        browserProvider,
        sessionControl: new FakeSessionControl(
          options.completionReason ?? "OPERATOR_COMPLETED",
        ),
        close: async () => {
          order?.push("runner-close");
        },
      },
      outcomePrompt: prompt,
      outcomeReporter: reporter,
    },
  };
}

function createArgs(): AssistedGroupAccessCliArgs {
  return {
    profileId: "profile-1",
    sourceGroupId: "source-group-1",
    baseUrl: "http://localhost:8081",
    browserProvider: "playwright",
    maxDurationMs: 600_000,
    allowHighRiskRoute: false,
  };
}

class FakeOutcomePrompt implements AssistedAccessOutcomePromptPort {
  public readonly calls: Array<{
    readonly profileId: string;
    readonly sourceGroupId: string;
  }> = [];

  public constructor(
    private readonly selection: AssistedAccessOutcomeSelection,
    private readonly order: string[] | undefined,
  ) {}

  public async promptOutcome(input: {
    readonly profileId: string;
    readonly sourceGroupId: string;
  }): Promise<AssistedAccessOutcomeSelection> {
    this.order?.push("prompt");
    this.calls.push(input);

    return this.selection;
  }
}

class FakeOutcomeReporter implements ProfileSourceAccessOutcomeReporterPort {
  public readonly calls: Array<{
    readonly profileId: string;
    readonly sourceGroupId: string;
    readonly outcome: ProfileSourceAccessReportableState;
  }> = [];

  public constructor(
    private readonly result: UpsertProfileSourceAccessResult | undefined,
    private readonly order: string[] | undefined,
  ) {}

  public async reportOutcome(input: {
    readonly profileId: string;
    readonly sourceGroupId: string;
    readonly outcome: ProfileSourceAccessReportableState;
  }): Promise<UpsertProfileSourceAccessResult> {
    this.order?.push("report");
    this.calls.push(input);

    return (
      this.result ?? {
        ok: true,
        profileId: input.profileId,
        sourceGroupId: input.sourceGroupId,
        accessState: input.outcome,
      }
    );
  }
}

class FakeContentManager implements AssistedAccessContentManagerPort {
  public async getSourceGroup(): Promise<SourceGroupLookupResult> {
    return {
      ok: true,
      sourceGroup: {
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
      },
    };
  }
}

class FakeProfileManager implements AssistedAccessProfileManagerPort {
  public constructor(
    private readonly releaseFails: boolean,
    private readonly order: string[] | undefined,
  ) {}

  public async checkoutProfileForAssistedGroupAccess(
    profileId: string,
  ): Promise<ProfileAssistedGroupAccessCheckoutResult> {
    return {
      ok: true,
      profileId,
      accountStage: "WARMING",
      leaseId: "lease-1",
      leaseExpiresAt: "2026-05-01T10:45:00.000Z",
    };
  }

  public async getRuntimeProfileConfiguration(
    leaseId: string,
  ): Promise<RuntimeProfileConfigurationResult> {
    return {
      ok: true,
      configuration: {
        profileId: "profile-1",
        leaseId,
        leaseExpiresAt: "2026-05-01T10:45:00.000Z",
        hardwareFingerprint: {
          userAgent: "Mozilla/5.0 Test",
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
      },
    };
  }

  public async releaseProfileLease(
    input: ProfileLeaseReleaseInput,
  ): Promise<ProfileLeaseReleaseResult> {
    this.order?.push("lease-release");

    if (this.releaseFails) {
      return {
        ok: false,
        statusCode: 503,
        errorCode: "PROFILE_MANAGER_HTTP_ERROR",
        errorMessage: "Profile Manager responded with HTTP 503.",
      };
    }

    return {
      ok: true,
      releasedAt: "2026-05-01T10:01:00.000Z",
    };
  }
}

class FakeBrowserProvider implements BrowserProviderPort {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;

  public constructor(private readonly session: FakeBrowserSession) {}

  public async launch(
    _config: BrowserProviderLaunchConfig,
  ): Promise<BrowserProviderSession> {
    return this.session;
  }
}

class FakeBrowserSession implements BrowserProviderSession {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;

  public constructor(
    private readonly page: FakeBrowserPage,
    private readonly order: string[] | undefined,
  ) {}

  public async newPage(): Promise<BrowserProviderPage> {
    return this.page;
  }

  public async close(): Promise<void> {
    this.order?.push("browser-close");
  }
}

class FakeBrowserPage implements BrowserProviderPage {
  public constructor(private readonly navigationFails: boolean) {}

  public url(): string {
    return "about:blank";
  }

  public async goto(
    _input: BrowserProviderNavigationInput,
  ): Promise<BrowserProviderNavigationResult | null> {
    if (this.navigationFails) {
      throw new Error("navigation failed");
    }

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
  public constructor(
    private readonly completionReason: "OPERATOR_COMPLETED" | "TIMEOUT" | "ABORTED",
  ) {}

  public async waitForCompletion(): Promise<
    "OPERATOR_COMPLETED" | "TIMEOUT" | "ABORTED"
  > {
    return this.completionReason;
  }
}
