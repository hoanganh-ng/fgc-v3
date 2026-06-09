import { describe, expect, it } from "vitest";
import type {
  ProvisioningCapturedSessionState,
  ProvisioningConfiguration,
  ProvisioningConfigurationResult,
  ProvisioningSessionIngestionResult,
} from "./provisioning-http-client";
import {
  runProfileProvisioning,
  type ProfileProvisioningClient,
  type ProfileProvisioningLogger,
  type ProvisioningBrowserLauncher,
  type ProvisioningBrowserSession,
  type WaitForOperatorConfirmation,
} from "./provisioning-runner";

describe("runProfileProvisioning", () => {
  it("runs the manual browser flow, ingests captured session state, and closes the browser", async () => {
    const client = new FakeProfileProvisioningClient();
    const browserLauncher = new FakeProvisioningBrowserLauncher();
    const logger = new CapturingLogger();
    let promptCalls = 0;

    const result = await runProfileProvisioning({
      token: "provisioning-token-1",
      client,
      browserLauncher,
      waitForOperatorConfirmation: async () => {
        promptCalls += 1;
      },
      logger,
    });

    expect(result).toEqual({
      ok: true,
      profileId: "profile-1",
      profileStatus: "READY",
    });
    expect(client.configurationCalls).toEqual(["provisioning-token-1"]);
    expect(browserLauncher.launchCalls).toEqual([createConfiguration()]);
    expect(browserLauncher.sessions[0]?.openLoginPageCalls).toBe(1);
    expect(promptCalls).toBe(1);
    expect(browserLauncher.sessions[0]?.captureSessionStateCalls).toBe(1);
    expect(client.ingestionCalls).toEqual([
      {
        token: "provisioning-token-1",
        sessionState: createSessionState(),
      },
    ]);
    expect(browserLauncher.sessions[0]?.closeCalls).toBe(1);

    const logs = logger.messages.join("\n");

    expect(logs).not.toContain("provisioning-token-1");
    expect(logs).not.toContain("session-cookie-value");
    expect(logs).not.toContain("local-storage-value");
    expect(logs).not.toContain("proxy-password");
  });

  it("does not launch the browser when provisioning configuration lookup fails", async () => {
    const client = new FakeProfileProvisioningClient();
    const browserLauncher = new FakeProvisioningBrowserLauncher();

    client.configurationResult = {
      ok: false,
      statusCode: 401,
      errorCode: "INVALID_PROVISIONING_TOKEN",
      errorMessage: "Invalid provisioning token.",
    };

    const result = await runProfileProvisioning({
      token: "provisioning-token-1",
      client,
      browserLauncher,
      waitForOperatorConfirmation: async () => {},
    });

    expect(result).toEqual({
      ok: false,
      statusCode: 401,
      errorCode: "INVALID_PROVISIONING_TOKEN",
      errorMessage: "Invalid provisioning token.",
    });
    expect(browserLauncher.launchCalls).toEqual([]);
    expect(client.ingestionCalls).toEqual([]);
  });

  it("closes the browser when session ingestion fails", async () => {
    const client = new FakeProfileProvisioningClient();
    const browserLauncher = new FakeProvisioningBrowserLauncher();

    client.ingestionResult = {
      ok: false,
      statusCode: 401,
      errorCode: "PROVISIONING_TOKEN_CONSUMED",
      errorMessage: "Provisioning token has already been consumed.",
    };

    const result = await runProfileProvisioning({
      token: "provisioning-token-1",
      client,
      browserLauncher,
      waitForOperatorConfirmation: async () => {},
    });

    expect(result).toEqual({
      ok: false,
      statusCode: 401,
      errorCode: "PROVISIONING_TOKEN_CONSUMED",
      errorMessage: "Provisioning token has already been consumed.",
    });
    expect(browserLauncher.sessions[0]?.closeCalls).toBe(1);
  });

  it("closes the browser when the operator interrupts before capture", async () => {
    const client = new FakeProfileProvisioningClient();
    const browserLauncher = new FakeProvisioningBrowserLauncher();
    const abortController = new AbortController();
    const waitForOperatorConfirmation: WaitForOperatorConfirmation = async () => {
      abortController.abort();
      throw new Error("Operator interrupted.");
    };

    const result = await runProfileProvisioning({
      token: "provisioning-token-1",
      client,
      browserLauncher,
      waitForOperatorConfirmation,
      abortSignal: abortController.signal,
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "PROFILE_PROVISIONING_INTERRUPTED",
      errorMessage:
        "Profile provisioning was interrupted before session submission completed.",
    });
    expect(browserLauncher.sessions[0]?.closeCalls).toBe(1);
    expect(client.ingestionCalls).toEqual([]);
  });

  it("closes the browser when capture fails", async () => {
    const client = new FakeProfileProvisioningClient();
    const browserLauncher = new FakeProvisioningBrowserLauncher();

    browserLauncher.nextSession.captureError = new Error("Capture failed.");

    const result = await runProfileProvisioning({
      token: "provisioning-token-1",
      client,
      browserLauncher,
      waitForOperatorConfirmation: async () => {},
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "PROFILE_PROVISIONING_BROWSER_FLOW_FAILED",
      errorMessage: "Capture failed.",
    });
    expect(browserLauncher.sessions[0]?.closeCalls).toBe(1);
  });
});

class FakeProfileProvisioningClient implements ProfileProvisioningClient {
  public readonly configurationCalls: string[] = [];
  public readonly ingestionCalls: Array<{
    readonly token: string;
    readonly sessionState: ProvisioningCapturedSessionState;
  }> = [];
  public configurationResult: ProvisioningConfigurationResult = {
    ok: true,
    configuration: createConfiguration(),
  };
  public ingestionResult: ProvisioningSessionIngestionResult = {
    ok: true,
    profile: {
      id: "profile-1",
      status: "READY",
      hasAuthenticationState: true,
      provisioningTokenStatus: "CONSUMED",
    },
  };

  public async getProvisioningConfiguration(
    provisioningToken: string,
  ): Promise<ProvisioningConfigurationResult> {
    this.configurationCalls.push(provisioningToken);

    return this.configurationResult;
  }

  public async ingestSessionState(
    provisioningToken: string,
    sessionState: ProvisioningCapturedSessionState,
  ): Promise<ProvisioningSessionIngestionResult> {
    this.ingestionCalls.push({
      token: provisioningToken,
      sessionState,
    });

    return this.ingestionResult;
  }
}

class FakeProvisioningBrowserLauncher implements ProvisioningBrowserLauncher {
  public readonly launchCalls: ProvisioningConfiguration[] = [];
  public readonly sessions: FakeProvisioningBrowserSession[] = [];
  public nextSession = new FakeProvisioningBrowserSession();

  public async launch(
    configuration: ProvisioningConfiguration,
  ): Promise<ProvisioningBrowserSession> {
    this.launchCalls.push(configuration);
    this.sessions.push(this.nextSession);

    return this.nextSession;
  }
}

class FakeProvisioningBrowserSession implements ProvisioningBrowserSession {
  public openLoginPageCalls = 0;
  public captureSessionStateCalls = 0;
  public closeCalls = 0;
  public captureError: unknown;

  public async openLoginPage(): Promise<void> {
    this.openLoginPageCalls += 1;
  }

  public async captureSessionState(): Promise<ProvisioningCapturedSessionState> {
    this.captureSessionStateCalls += 1;

    if (this.captureError !== undefined) {
      throw this.captureError;
    }

    return createSessionState();
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class CapturingLogger implements ProfileProvisioningLogger {
  public readonly messages: string[] = [];

  public info(message: string): void {
    this.messages.push(message);
  }

  public warn(message: string): void {
    this.messages.push(message);
  }
}

function createConfiguration(): ProvisioningConfiguration {
  return {
    profileId: "profile-1",
    networkContext: {
      proxy: {
        protocol: "HTTPS",
        host: "proxy.example.test",
        port: 443,
        credentials: {
          username: "proxy-user",
          password: "proxy-password",
        },
      },
      killswitch: {
        enabled: true,
        failClosed: true,
      },
    },
    hardwareFingerprint: {
      userAgent: "Synthetic Browser",
      viewport: {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
      },
      languages: ["en-US", "en"],
      hardwareConcurrency: 8,
      timezone: "America/Los_Angeles",
    },
  };
}

function createSessionState(): ProvisioningCapturedSessionState {
  return {
    cookies: [
      {
        name: "c_user",
        value: "session-cookie-value",
        domain: ".facebook.com",
        path: "/",
        expiresAt: null,
        httpOnly: true,
        secure: true,
        sameSite: "LAX",
      },
    ],
    localStorage: [
      {
        origin: "https://www.facebook.com",
        key: "session-key",
        value: "local-storage-value",
      },
    ],
  };
}
