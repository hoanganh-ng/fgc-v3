import { describe, expect, it } from "vitest";
import {
  parseCloakBrowserProvisioningProbeCliArgs,
} from "./cloakbrowser-probe-cli-args";
import {
  runCloakBrowserProvisioningProbe,
  type CloakBrowserProvisioningProbeLogger,
} from "./cloakbrowser-probe";
import type {
  ProvisioningBrowserProviderLaunchConfig,
  ProvisioningBrowserProviderPage,
  ProvisioningBrowserProviderPort,
  ProvisioningCookieShape,
} from "./provisioning-browser-provider";

describe("CloakBrowser provisioning probe", () => {
  it("parses availability-only and headed probe arguments", () => {
    expect(parseCloakBrowserProvisioningProbeCliArgs(["--"])).toEqual({
      launchHeaded: false,
      timeoutMs: 15_000,
    });
    expect(
      parseCloakBrowserProvisioningProbeCliArgs([
        "--launch-headed",
        "--timeout-ms",
        "2500",
      ]),
    ).toEqual({
      launchHeaded: true,
      timeoutMs: 2_500,
    });
    expect(() =>
      parseCloakBrowserProvisioningProbeCliArgs(["--timeout-ms", "0"]),
    ).toThrow("--timeout-ms must be a positive integer.");
  });

  it("reports availability without launching when launch is not requested", async () => {
    const provider = new FakeProbeProvider();
    const messages: string[] = [];

    await expect(
      runCloakBrowserProvisioningProbe({
        launchHeaded: false,
        timeoutMs: 1_000,
        provider,
        probeAvailability: async () => ({
          ok: true,
          reasonCode: "CLOAK_BROWSER_AVAILABLE",
        }),
        logger: collectMessages(messages),
      }),
    ).resolves.toEqual({
      ok: true,
      availabilityReasonCode: "CLOAK_BROWSER_AVAILABLE",
      launched: false,
    });
    expect(provider.launchCalls).toEqual([]);
    expect(messages.join("\n")).toContain("CLOAK_BROWSER_AVAILABLE");
  });

  it("launches a headed synthetic page and closes it when requested", async () => {
    const provider = new FakeProbeProvider();

    await expect(
      runCloakBrowserProvisioningProbe({
        launchHeaded: true,
        timeoutMs: 1_000,
        provider,
        probeAvailability: async () => ({
          ok: true,
          reasonCode: "CLOAK_BROWSER_AVAILABLE",
        }),
      }),
    ).resolves.toEqual({
      ok: true,
      availabilityReasonCode: "CLOAK_BROWSER_AVAILABLE",
      launched: true,
    });
    expect(provider.launchCalls).toHaveLength(1);
    expect(provider.launchCalls[0]).toMatchObject({
      providerName: "CLOAK_BROWSER",
      headless: false,
      profileId: "cloakbrowser-provisioning-probe-profile",
    });
    expect(provider.launchCalls[0]?.proxy).toBeUndefined();
    expect(provider.session.page?.gotoCalls).toEqual([
      {
        url: "data:text/html,<html><body>cloakbrowser-provisioning-probe</body></html>",
        options: {
          waitUntil: "domcontentloaded",
          timeout: 1_000,
        },
      },
    ]);
    expect(provider.session.page?.closeCalls).toBe(1);
    expect(provider.session.closeCalls).toBe(1);
  });

  it("returns sanitized launch failures and closes partial sessions", async () => {
    const provider = new FakeProbeProvider();
    provider.launchError = new Error(
      "Launch failed for cloakbrowser-provisioning-probe-profile at data:text/html,<secret>.",
    );

    await expect(
      runCloakBrowserProvisioningProbe({
        launchHeaded: true,
        timeoutMs: 1_000,
        provider,
        probeAvailability: async () => ({
          ok: true,
          reasonCode: "CLOAK_BROWSER_AVAILABLE",
        }),
      }),
    ).resolves.toEqual({
      ok: false,
      availabilityReasonCode: "CLOAK_BROWSER_AVAILABLE",
      errorCode: "CLOAK_BROWSER_PROVISIONING_LAUNCH_FAILED",
      errorMessage: "Launch failed for [profile-id] at [probe-page]",
    });
  });
});

function collectMessages(
  messages: string[],
): CloakBrowserProvisioningProbeLogger {
  return {
    info: (message) => messages.push(message),
    warn: (message) => messages.push(message),
    error: (message) => messages.push(message),
  };
}

class FakeProbeProvider implements ProvisioningBrowserProviderPort {
  public readonly providerName = "CLOAK_BROWSER" as const;
  public readonly launchCalls: ProvisioningBrowserProviderLaunchConfig[] = [];
  public readonly session = new FakeProbeSession();
  public launchError: unknown;

  public async launch(
    config: ProvisioningBrowserProviderLaunchConfig,
  ): Promise<FakeProbeSession> {
    this.launchCalls.push(config);

    if (this.launchError !== undefined) {
      throw this.launchError;
    }

    return this.session;
  }
}

class FakeProbeSession {
  public page: FakeProbePage | undefined;
  public closeCalls = 0;

  public async newPage(): Promise<ProvisioningBrowserProviderPage> {
    this.page = new FakeProbePage();

    return this.page;
  }

  public async cookies(): Promise<readonly ProvisioningCookieShape[]> {
    return [];
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class FakeProbePage implements ProvisioningBrowserProviderPage {
  public readonly gotoCalls: Array<{
    readonly url: string;
    readonly options: {
      readonly waitUntil: "domcontentloaded";
      readonly timeout: number;
    };
  }> = [];
  public closeCalls = 0;

  public async goto(
    url: string,
    options: {
      readonly waitUntil: "domcontentloaded";
      readonly timeout: number;
    },
  ): Promise<unknown> {
    this.gotoCalls.push({ url, options });

    return null;
  }

  public async evaluate<T = unknown>(): Promise<T> {
    return undefined as T;
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}
