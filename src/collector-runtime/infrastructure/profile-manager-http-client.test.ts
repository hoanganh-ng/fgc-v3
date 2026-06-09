import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RunFacebookGroupCollectionUseCase,
} from "../application";
import type {
  CapturedFacebookPayloadSubmissionUseCase,
  FacebookGroupPayloadCaptureInput,
  FacebookGroupPayloadCapturePort,
  FacebookPayloadCaptureResult,
} from "../application";
import type {
  SubmitCapturedFacebookPayloadInput,
  SubmitCapturedFacebookPayloadResult,
} from "../application";
import {
  MissingProfileManagerHttpClientConfigError,
  ProfileManagerHttpClient,
  loadProfileManagerHttpClientConfig,
} from "./profile-manager-http-client";
import type {
  FetchLike,
  FetchLikeRequestInit,
  FetchLikeResponse,
} from "./content-manager-http-client";

describe("ProfileManagerHttpClient", () => {
  it("posts checkout requests to /collector/profiles/checkout using the configured base URL", async () => {
    const fetch = new FakeFetch(createCheckoutResponse());
    const client = new ProfileManagerHttpClient(
      loadProfileManagerHttpClientConfig({
        PROFILE_MANAGER_BASE_URL: " https://profile-manager.test/api ",
      }),
      {
        fetchImplementation: fetch.fetch,
      },
    );

    const result = await client.checkoutProfile({
      sourceGroupId: "source-group-1",
      purpose: "FACEBOOK_GROUP_COLLECTION",
    });

    expect(result).toEqual({
      ok: true,
      profileId: "profile-1",
      leaseId: "lease-1",
      leaseExpiresAt: "2026-01-05T18:45:00.000Z",
    });
    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0]).toMatchObject({
      input: "https://profile-manager.test/api/collector/profiles/checkout",
      init: {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
      },
    });
    expect(parseRequestBody(fetch)).toEqual({});
  });

  it("maps checkout success without exposing broad Profile Manager runtime configuration", async () => {
    const fetch = new FakeFetch(createCheckoutResponse());
    const client = createClient(fetch.fetch);

    const result = await client.checkoutProfile({});

    expect(result).toEqual({
      ok: true,
      profileId: "profile-1",
      leaseId: "lease-1",
      leaseExpiresAt: "2026-01-05T18:45:00.000Z",
    });
    expect(result).not.toHaveProperty("authenticationState");
    expect(result).not.toHaveProperty("networkContext");
    expect(result).not.toHaveProperty("hardwareFingerprint");
  });

  it("maps no-profile-available checkout responses to structured failures", async () => {
    const fetch = new FakeFetch(
      createErrorResponse(
        404,
        "NO_ELIGIBLE_PROFILE_AVAILABLE",
        "No checkout-eligible collector profile is available.",
      ),
    );
    const client = createClient(fetch.fetch);

    await expect(client.checkoutProfile({})).resolves.toEqual({
      ok: false,
      statusCode: 404,
      errorCode: "NO_ELIGIBLE_PROFILE_AVAILABLE",
      errorMessage: "No checkout-eligible collector profile is available.",
    });
  });

  it("maps checkout validation, not-found, conflict, and server errors", async () => {
    const cases = [
      [400, "VALIDATION_ERROR", "Request validation failed."],
      [404, "PROFILE_NOT_FOUND", "Collector profile not found: profile-1."],
      [
        409,
        "PROFILE_NOT_CHECKOUT_ELIGIBLE",
        "Collector profile is not checkout eligible: profile-1.",
      ],
      [503, "INTERNAL_SERVER_ERROR", "Profile Manager is unavailable."],
    ] as const;

    for (const [statusCode, errorCode, errorMessage] of cases) {
      const fetch = new FakeFetch(
        createErrorResponse(statusCode, errorCode, errorMessage),
      );
      const client = createClient(fetch.fetch);

      await expect(client.checkoutProfile({})).resolves.toEqual({
        ok: false,
        statusCode,
        errorCode,
        errorMessage,
      });
    }
  });

  it("maps checkout network failures to structured failures", async () => {
    const fetch = new FakeFetch(createCheckoutResponse());

    fetch.setError(new Error("connect ECONNREFUSED"));

    const client = createClient(fetch.fetch);

    await expect(client.checkoutProfile({})).resolves.toEqual({
      ok: false,
      errorCode: "PROFILE_MANAGER_NETWORK_ERROR",
      errorMessage: "connect ECONNREFUSED",
    });
  });

  it("posts release requests to /collector/profile-leases/:leaseId/release", async () => {
    const fetch = new FakeFetch(createReleaseResponse());
    const client = new ProfileManagerHttpClient(
      {
        baseUrl: "https://profile-manager.test/api",
      },
      {
        fetchImplementation: fetch.fetch,
      },
    );

    const result = await client.releaseProfileLease({
      profileId: "profile-1",
      leaseId: "lease-1",
      macroActionsPerformed: 7,
    });

    expect(result).toEqual({
      ok: true,
      releasedAt: "2026-01-05T18:10:00.000Z",
    });
    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0]).toMatchObject({
      input:
        "https://profile-manager.test/api/collector/profile-leases/lease-1/release",
      init: {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
      },
    });
    expect(parseRequestBody(fetch)).toEqual({
      macroActionsPerformed: 7,
    });
  });

  it("maps release success responses", async () => {
    const fetch = new FakeFetch(createReleaseResponse());
    const client = createClient(fetch.fetch);

    await expect(
      client.releaseProfileLease({
        profileId: "profile-1",
        leaseId: "lease-1",
      }),
    ).resolves.toEqual({
      ok: true,
      releasedAt: "2026-01-05T18:10:00.000Z",
    });
  });

  it("maps release not-found, conflict, and server errors", async () => {
    const cases = [
      [404, "PROFILE_LEASE_NOT_FOUND", "Profile lease not found: lease-1."],
      [409, "PROFILE_LEASE_ALREADY_CLOSED", "Profile lease lease-1 is already RELEASED."],
      [503, "INTERNAL_SERVER_ERROR", "Profile Manager is unavailable."],
    ] as const;

    for (const [statusCode, errorCode, errorMessage] of cases) {
      const fetch = new FakeFetch(
        createErrorResponse(statusCode, errorCode, errorMessage),
      );
      const client = createClient(fetch.fetch);

      await expect(
        client.releaseProfileLease({
          profileId: "profile-1",
          leaseId: "lease-1",
        }),
      ).resolves.toEqual({
        ok: false,
        statusCode,
        errorCode,
        errorMessage,
      });
    }
  });

  it("maps release network failures to structured failures", async () => {
    const fetch = new FakeFetch(createReleaseResponse());

    fetch.setError(new Error("fetch failed"));

    const client = createClient(fetch.fetch);

    await expect(
      client.releaseProfileLease({
        profileId: "profile-1",
        leaseId: "lease-1",
      }),
    ).resolves.toEqual({
      ok: false,
      errorCode: "PROFILE_MANAGER_NETWORK_ERROR",
      errorMessage: "fetch failed",
    });
  });

  it("gets runtime configuration by lease id using the trusted lease endpoint", async () => {
    const fetch = new FakeFetch(createRuntimeConfigurationResponse());
    const client = createClient(fetch.fetch);

    const result = await client.getRuntimeProfileConfiguration("lease-1");

    expect(result).toEqual({
      ok: true,
      configuration: {
        profileId: "profile-1",
        leaseId: "lease-1",
        leaseExpiresAt: "2026-01-05T18:45:00.000Z",
        hardwareFingerprint: {
          userAgent: "Synthetic Browser",
        },
        networkContext: {
          proxy: {
            protocol: "HTTPS",
            host: "proxy.example.test",
            port: 443,
            credentials: {
              username: "collector",
              password: "secret",
            },
          },
          killswitch: {
            enabled: true,
          },
        },
        authenticationState: {
          cookies: [
            {
              name: "session",
              value: "session-cookie-value",
            },
          ],
          localStorage: [
            {
              key: "session",
              value: "local-storage-value",
            },
          ],
        },
        temporalRoutine: {
          timezone: "America/Los_Angeles",
        },
        safetyThresholds: {
          maxSessionsPerDay: 3,
        },
        contentAffinities: {
          primaryTopics: ["travel"],
        },
      },
    });
    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0]).toMatchObject({
      input:
        "https://profile-manager.test/collector/profile-leases/lease-1/runtime-configuration",
      init: {
        method: "GET",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
      },
    });
    expect(fetch.calls[0]?.init).not.toHaveProperty("body");
    expect(fetch.calls.map((call) => call.input)).not.toContain(
      "https://profile-manager.test/collector/profiles/profile-1",
    );
    if (!result.ok) {
      throw new Error("Expected runtime configuration lookup to succeed.");
    }

    expect(result.configuration).not.toHaveProperty("provisioningToken");
    expect(result.configuration).not.toHaveProperty("behavioralPersona");
  });

  it("maps runtime configuration not-found, conflict, and server errors", async () => {
    const cases = [
      [404, "PROFILE_LEASE_NOT_FOUND", "Profile lease not found: lease-1."],
      [
        409,
        "PROFILE_LEASE_ALREADY_CLOSED",
        "Profile lease lease-1 is already RELEASED.",
      ],
      [503, "INTERNAL_SERVER_ERROR", "Profile Manager is unavailable."],
    ] as const;

    for (const [statusCode, errorCode, errorMessage] of cases) {
      const fetch = new FakeFetch(
        createErrorResponse(statusCode, errorCode, errorMessage),
      );
      const client = createClient(fetch.fetch);

      await expect(
        client.getRuntimeProfileConfiguration("lease-1"),
      ).resolves.toEqual({
        ok: false,
        statusCode,
        errorCode,
        errorMessage,
      });
    }
  });

  it("maps runtime configuration network failures to structured failures", async () => {
    const fetch = new FakeFetch(createRuntimeConfigurationResponse());

    fetch.setError(new Error("runtime config fetch failed"));

    const client = createClient(fetch.fetch);

    await expect(
      client.getRuntimeProfileConfiguration("lease-1"),
    ).resolves.toEqual({
      ok: false,
      errorCode: "PROFILE_MANAGER_NETWORK_ERROR",
      errorMessage: "runtime config fetch failed",
    });
  });

  it("maps invalid runtime configuration responses to structured failures", async () => {
    const fetch = new FakeFetch(
      createResponse(200, {
        profileId: "profile-1",
      }),
    );
    const client = createClient(fetch.fetch);

    await expect(
      client.getRuntimeProfileConfiguration("lease-1"),
    ).resolves.toEqual({
      ok: false,
      statusCode: 200,
      errorCode: "PROFILE_MANAGER_RESPONSE_ERROR",
      errorMessage:
        "Profile Manager runtime configuration response is invalid.",
    });
  });

  it("runs orchestration with fake capture/submission and the real Profile Manager HTTP client", async () => {
    const fetch = new FakeFetch(createCheckoutResponse(), createReleaseResponse());
    const profileManagerClient = createClient(fetch.fetch);
    const capturePort = new FakeCapturePort();
    const submissionUseCase = new FakeSubmissionUseCase();
    const useCase = new RunFacebookGroupCollectionUseCase({
      profileLeasePort: profileManagerClient,
      payloadCapturePort: capturePort,
      submitCapturedPayloadUseCase: submissionUseCase,
    });

    const result = await useCase.execute({
      sourceGroupId: "source-group-1",
      sourceGroupUrl: "https://www.facebook.com/groups/group-1/",
    });

    expect(result).toMatchObject({
      ok: true,
      profileId: "profile-1",
      leaseId: "lease-1",
      capturedPayloadCount: 1,
      extractedCandidateCount: 1,
      submittedCount: 1,
      failedSubmissionCount: 0,
      leaseReleased: true,
    });
    expect(fetch.calls.map((call) => call.input)).toEqual([
      "https://profile-manager.test/collector/profiles/checkout",
      "https://profile-manager.test/collector/profile-leases/lease-1/release",
    ]);
    expect(capturePort.calls).toEqual([
      {
        sourceGroupId: "source-group-1",
        sourceGroupUrl: "https://www.facebook.com/groups/group-1/",
        profileId: "profile-1",
        leaseId: "lease-1",
      },
    ]);
  });

  it("fails clearly when PROFILE_MANAGER_BASE_URL is missing", () => {
    expect(() => loadProfileManagerHttpClientConfig({})).toThrow(
      MissingProfileManagerHttpClientConfigError,
    );
    expect(() =>
      loadProfileManagerHttpClientConfig({
        PROFILE_MANAGER_BASE_URL: " ",
      }),
    ).toThrow(
      "PROFILE_MANAGER_BASE_URL is required for Profile Manager HTTP client configuration.",
    );
  });

  it("does not import Profile Manager repositories, database code, or composition roots", () => {
    const source = readFileSync(
      new URL("./profile-manager-http-client.ts", import.meta.url),
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

class FakeCapturePort implements FacebookGroupPayloadCapturePort {
  public readonly calls: FacebookGroupPayloadCaptureInput[] = [];

  public async captureGroupPayloads(
    input: FacebookGroupPayloadCaptureInput,
  ): Promise<FacebookPayloadCaptureResult> {
    this.calls.push(input);

    return {
      ok: true,
      capturedPayloads: [
        {
          capturedAt: new Date("2026-03-01T12:00:00.000Z"),
          payload: {
            data: "captured-facebook-payload",
          },
        },
      ],
      warnings: [],
    };
  }
}

class FakeSubmissionUseCase implements CapturedFacebookPayloadSubmissionUseCase {
  public readonly calls: SubmitCapturedFacebookPayloadInput[] = [];

  public async execute(
    input: SubmitCapturedFacebookPayloadInput,
  ): Promise<SubmitCapturedFacebookPayloadResult> {
    this.calls.push(input);

    return {
      ok: true,
      extractedCandidateCount: 1,
      submittedCount: 1,
      failedSubmissionCount: 0,
      warnings: [],
      submissions: [
        {
          externalPostId: "post-1",
          ok: true,
          statusCode: 201,
          contentItemId: "content-item-1",
        },
      ],
    };
  }
}

function createClient(fetchImplementation: FetchLike): ProfileManagerHttpClient {
  return new ProfileManagerHttpClient(
    {
      baseUrl: "https://profile-manager.test",
    },
    {
      fetchImplementation,
    },
  );
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

function createErrorResponse(
  status: number,
  code: string,
  message: string,
): FetchLikeResponse {
  return createResponse(status, {
    error: {
      code,
      message,
    },
  });
}

function createCheckoutResponse(): FetchLikeResponse {
  return createResponse(200, {
    lease: {
      id: "lease-1",
      profileId: "profile-1",
      leasedAt: "2026-01-05T18:00:00.000Z",
      expiresAt: "2026-01-05T18:45:00.000Z",
      releasedAt: null,
      status: "ACTIVE",
    },
    profile: {
      profileId: "profile-1",
      networkContext: {
        proxy: {
          protocol: "HTTPS",
          host: "proxy.example.test",
          port: 443,
          credentials: {
            username: "collector",
            password: "secret",
          },
        },
        killswitch: {
          enabled: true,
        },
      },
      hardwareFingerprint: {
        userAgent: "Synthetic Browser",
      },
      authenticationState: {
        cookies: [
          {
            name: "session",
            value: "session-cookie-value",
          },
        ],
        localStorage: [
          {
            key: "session",
            value: "local-storage-value",
          },
        ],
      },
      behavioralPersona: {},
      temporalRoutine: {},
      safetyThresholds: {},
      contentAffinities: {},
    },
  });
}

function createRuntimeConfigurationResponse(): FetchLikeResponse {
  return createResponse(200, {
    profileId: "profile-1",
    leaseId: "lease-1",
    leaseExpiresAt: "2026-01-05T18:45:00.000Z",
    networkContext: {
      proxy: {
        protocol: "HTTPS",
        host: "proxy.example.test",
        port: 443,
        credentials: {
          username: "collector",
          password: "secret",
        },
      },
      killswitch: {
        enabled: true,
      },
    },
    hardwareFingerprint: {
      userAgent: "Synthetic Browser",
    },
    authenticationState: {
      cookies: [
        {
          name: "session",
          value: "session-cookie-value",
        },
      ],
      localStorage: [
        {
          key: "session",
          value: "local-storage-value",
        },
      ],
    },
    behavioralPersona: {
      scrollStyle: "STEADY",
    },
    temporalRoutine: {
      timezone: "America/Los_Angeles",
    },
    safetyThresholds: {
      maxSessionsPerDay: 3,
    },
    contentAffinities: {
      primaryTopics: ["travel"],
    },
  });
}

function createReleaseResponse(): FetchLikeResponse {
  return createResponse(200, {
    lease: {
      id: "lease-1",
      profileId: "profile-1",
      leasedAt: "2026-01-05T18:00:00.000Z",
      expiresAt: "2026-01-05T18:45:00.000Z",
      releasedAt: "2026-01-05T18:10:00.000Z",
      status: "RELEASED",
    },
    profile: {
      id: "profile-1",
      status: "READY",
    },
  });
}

function parseRequestBody(
  fetch: FakeFetch,
  callIndex = 0,
): Record<string, unknown> {
  const call = fetch.calls[callIndex];

  if (call?.init?.body === undefined) {
    throw new Error("Expected a JSON request body.");
  }

  return JSON.parse(call.init.body) as Record<string, unknown>;
}
