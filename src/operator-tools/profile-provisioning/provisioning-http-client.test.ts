import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ProfileProvisioningHttpClient,
  type FetchLike,
  type FetchLikeRequestInit,
  type FetchLikeResponse,
} from "./provisioning-http-client";

describe("ProfileProvisioningHttpClient", () => {
  it("gets provisioning configuration by token using the real backend route", async () => {
    const fetch = new FakeFetch(createConfigurationResponse());
    const client = createClient(fetch.fetch);

    const result = await client.getProvisioningConfiguration(
      "provisioning token/1",
    );

    expect(result).toEqual({
      ok: true,
      configuration: {
        profileId: "profile-1",
        networkContext: {
          proxy: {
            protocol: "HTTPS",
            host: "proxy.example.test",
            port: 443,
            countryCode: "US",
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
          platform: "Linux x86_64",
          timezone: "America/Los_Angeles",
        },
      },
    });
    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0]).toMatchObject({
      input:
        "https://profile-manager.test/api/collector/provisioning/provisioning%20token%2F1/configuration",
      init: {
        method: "GET",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
      },
    });
    expect(fetch.calls[0]?.init).not.toHaveProperty("body");
  });

  it("posts captured session state by token using the real ingestion route and DTO", async () => {
    const fetch = new FakeFetch(createIngestionResponse());
    const client = createClient(fetch.fetch);

    const result = await client.ingestSessionState("provisioning-token-1", {
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
    });

    expect(result).toEqual({
      ok: true,
      profile: {
        id: "profile-1",
        status: "READY",
        hasAuthenticationState: true,
        provisioningTokenStatus: "CONSUMED",
      },
    });
    expect(fetch.calls[0]).toMatchObject({
      input:
        "https://profile-manager.test/api/collector/provisioning/provisioning-token-1/session",
      init: {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
      },
    });
    expect(parseRequestBody(fetch)).toEqual({
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
    });
  });

  it("preserves backend validation issues while redacting the presented token", async () => {
    const fetch = new FakeFetch(
      createResponse(400, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed for provisioning-token-1.",
          issues: [
            {
              path: "cookies.0.value",
              message: "Invalid value from provisioning-token-1.",
            },
          ],
        },
      }),
    );
    const client = createClient(fetch.fetch);

    await expect(
      client.ingestSessionState("provisioning-token-1", {
        cookies: [],
        localStorage: [],
      }),
    ).resolves.toEqual({
      ok: false,
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      errorMessage: "Request validation failed for [redacted].",
      issues: [
        {
          path: "cookies.0.value",
          message: "Invalid value from [redacted].",
        },
      ],
    });
  });

  it("maps invalid success responses to structured failures", async () => {
    const fetch = new FakeFetch(
      createResponse(200, {
        profileId: "profile-1",
      }),
    );
    const client = createClient(fetch.fetch);

    await expect(
      client.getProvisioningConfiguration("provisioning-token-1"),
    ).resolves.toEqual({
      ok: false,
      statusCode: 200,
      errorCode: "PROFILE_PROVISIONING_RESPONSE_ERROR",
      errorMessage:
        "Profile Manager provisioning configuration response is invalid.",
    });
  });

  it("maps network failures without leaking the token", async () => {
    const fetch = new FakeFetch(createConfigurationResponse());

    fetch.setError(new Error("connect failed for provisioning-token-1"));

    const client = createClient(fetch.fetch);
    const result = await client.getProvisioningConfiguration(
      "provisioning-token-1",
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "PROFILE_PROVISIONING_NETWORK_ERROR",
      errorMessage: "connect failed for [redacted]",
    });
    expect(JSON.stringify(result)).not.toContain("provisioning-token-1");
  });

  it("does not import Profile Manager domain, application, repositories, database code, or composition roots", () => {
    const source = readFileSync(
      new URL("./provisioning-http-client.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(?:from|import)\s*(?:\(\s*)?["'][^"']*(?:collector-profile-manager|infrastructure\/database|drizzle|postgres|repositories\/|composition)[^"']*["']/i,
    );
  });
});

class FakeFetch {
  public readonly calls: Array<{
    readonly input: string;
    readonly init?: FetchLikeRequestInit;
  }> = [];
  private error: unknown;
  private readonly responses: FetchLikeResponse[];

  public constructor(...responses: FetchLikeResponse[]) {
    this.responses = [...responses];
  }

  public readonly fetch: FetchLike = async (input, init) => {
    this.calls.push({
      input,
      ...(init !== undefined ? { init } : {}),
    });

    if (this.error !== undefined) {
      throw this.error;
    }

    const response = this.responses.shift();

    if (response === undefined) {
      throw new Error("Unexpected Profile Manager HTTP request.");
    }

    return response;
  };

  public setError(error: unknown): void {
    this.error = error;
  }
}

function createClient(fetchImplementation: FetchLike): ProfileProvisioningHttpClient {
  return new ProfileProvisioningHttpClient(
    {
      baseUrl: "https://profile-manager.test/api",
    },
    {
      fetchImplementation,
    },
  );
}

function createConfigurationResponse(): FetchLikeResponse {
  return createResponse(200, {
    profileId: "profile-1",
    networkContext: {
      proxy: {
        protocol: "HTTPS",
        host: "proxy.example.test",
        port: 443,
        countryCode: "US",
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
      platform: "Linux x86_64",
      timezone: "America/Los_Angeles",
    },
  });
}

function createIngestionResponse(): FetchLikeResponse {
  return createResponse(200, {
    profile: {
      id: "profile-1",
      status: "READY",
      hasAuthenticationState: true,
      provisioningTokenStatus: "CONSUMED",
    },
  });
}

function createResponse(status: number, body: unknown): FetchLikeResponse {
  const responseText = JSON.stringify(body);

  return {
    status,
    async json() {
      return JSON.parse(responseText);
    },
    async text() {
      return responseText;
    },
  };
}

function parseRequestBody(fetch: FakeFetch): Record<string, unknown> {
  const body = fetch.calls[0]?.init?.body;

  if (body === undefined) {
    throw new Error("Expected a JSON request body.");
  }

  return JSON.parse(body) as Record<string, unknown>;
}
