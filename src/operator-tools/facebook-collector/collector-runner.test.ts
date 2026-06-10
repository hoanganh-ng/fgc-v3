import { describe, expect, it } from "vitest";
import { runFacebookCollectorCommand } from "./collector-runner";
import type {
  FacebookCollectorCheckoutDiagnosticsPort,
  FacebookCollectorLogger,
  FacebookCollectorSourceGroupResolver,
} from "./collector-runner";
import type {
  CapturedFacebookPayloadSubmissionUseCase,
  FacebookGroupPayloadCaptureInput,
  FacebookGroupPayloadCapturePort,
  FacebookPayloadCaptureResult,
  ProfileCheckoutInput,
  ProfileCheckoutResult,
  ProfileLeasePort,
  ProfileLeaseReleaseInput,
  ProfileLeaseReleaseResult,
  SubmitCapturedFacebookPayloadInput,
  SubmitCapturedFacebookPayloadResult,
} from "../../collector-runtime/application";
import type {
  ContentManagerSourceGroup,
  ContentManagerSourceGroupLookupResult,
  SafeProfileStatusCountsResult,
} from "../../collector-runtime/infrastructure";

describe("runFacebookCollectorCommand", () => {
  it("runs the existing collection use case and prints a safe count summary", async () => {
    const profileLeasePort = new FakeProfileLeasePort();
    const payloadCapturePort = new FakeCapturePort();
    const submitCapturedPayloadUseCase = new FakeSubmissionUseCase();
    const sourceGroupResolver = new FakeSourceGroupResolver();
    const logger = new MemoryLogger();

    const result = await runFacebookCollectorCommand({
      args: {
        sourceGroupId: "source-group-1",
        baseUrl: "http://localhost:8081",
        maxScrolls: 3,
        maxDurationMs: 30_000,
        diagnoseCheckout: false,
      },
      logger,
      dependencies: {
        profileLeasePort,
        payloadCapturePort,
        submitCapturedPayloadUseCase,
        sourceGroupResolver,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      sourceGroupId: "source-group-1",
      leaseReleased: true,
      capturedGraphQLResponseCount: 1,
      extractedCandidateCount: 2,
      submittedContentItemCount: 2,
      failedSubmissionCount: 0,
      warningCount: 1,
    });
    expect(sourceGroupResolver.calls).toEqual(["source-group-1"]);
    expect(profileLeasePort.checkoutCalls).toHaveLength(1);
    expect(payloadCapturePort.calls).toEqual([
      {
        sourceGroupId: "source-group-1",
        sourceGroupUrl: "https://www.facebook.com/groups/group-1",
        profileId: "profile-1",
        leaseId: "lease-1",
      },
    ]);
    expect(profileLeasePort.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
      },
    ]);

    const output = logger.messages.join("\n");

    expect(output).toContain("GraphQL responses captured: 1");
    expect(output).toContain("Extractor candidates produced: 2");
    expect(output).toContain("Content items submitted: 2");
    expect(output).not.toContain("rawGraphQLPayload");
    expect(output).not.toContain("session-cookie-value");
    expect(output).not.toContain("local-storage-value");
    expect(output).not.toContain("proxy-password");
    expect(output).not.toContain("Authorization");
  });

  it("does not print unsafe error messages from failed downstream steps", async () => {
    const profileLeasePort = new FakeProfileLeasePort();
    const payloadCapturePort = new FakeCapturePort();
    const submitCapturedPayloadUseCase = new FakeSubmissionUseCase();
    const sourceGroupResolver = new FakeSourceGroupResolver();
    const logger = new MemoryLogger();

    submitCapturedPayloadUseCase.result = {
      ok: true,
      extractedCandidateCount: 1,
      submittedCount: 0,
      failedSubmissionCount: 1,
      warnings: [],
      submissions: [
        {
          externalPostId: "post-1",
          ok: false,
          errorCode: "CONTENT_MANAGER_HTTP_ERROR",
          errorMessage:
            "unsafe rawGraphQLPayload session-cookie-value proxy-password",
        },
      ],
    };

    const result = await runFacebookCollectorCommand({
      args: {
        groupUrl: "https://www.facebook.com/groups/group-1",
        sourceGroupId: "source-group-1",
        baseUrl: "http://localhost:8081",
        maxScrolls: 3,
        maxDurationMs: 30_000,
        diagnoseCheckout: false,
      },
      logger,
      dependencies: {
        profileLeasePort,
        payloadCapturePort,
        submitCapturedPayloadUseCase,
        sourceGroupResolver,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.leaseReleased).toBe(true);

    const output = logger.messages.join("\n");

    expect(output).toContain("Error CONTENT_SUBMISSION_FAILED");
    expect(output).not.toContain("rawGraphQLPayload");
    expect(output).not.toContain("session-cookie-value");
    expect(output).not.toContain("proxy-password");
  });

  it("uses --group-url only as a warned development override", async () => {
    const profileLeasePort = new FakeProfileLeasePort();
    const payloadCapturePort = new FakeCapturePort();
    const submitCapturedPayloadUseCase = new FakeSubmissionUseCase();
    const sourceGroupResolver = new FakeSourceGroupResolver({
      sourceGroup: {
        id: "source-group-1",
        platform: "FACEBOOK",
        status: "ACTIVE",
        url: "https://www.facebook.com/groups/stored-group",
      },
    });
    const logger = new MemoryLogger();

    await runFacebookCollectorCommand({
      args: {
        groupUrl: "https://www.facebook.com/groups/override-group",
        sourceGroupId: "source-group-1",
        baseUrl: "http://localhost:8081",
        maxScrolls: 3,
        maxDurationMs: 30_000,
        diagnoseCheckout: false,
      },
      logger,
      dependencies: {
        profileLeasePort,
        payloadCapturePort,
        submitCapturedPayloadUseCase,
        sourceGroupResolver,
      },
    });

    expect(payloadCapturePort.calls[0]).toMatchObject({
      sourceGroupUrl: "https://www.facebook.com/groups/override-group",
    });
    expect(logger.messages.join("\n")).toContain(
      "--group-url is a development override",
    );
  });

  it("rejects inactive source groups before checkout or browser launch", async () => {
    const profileLeasePort = new FakeProfileLeasePort();
    const payloadCapturePort = new FakeCapturePort();
    const sourceGroupResolver = new FakeSourceGroupResolver({
      sourceGroup: {
        id: "source-group-1",
        platform: "FACEBOOK",
        status: "PAUSED",
        url: "https://www.facebook.com/groups/group-1",
      },
    });
    const logger = new MemoryLogger();

    const result = await runFacebookCollectorCommand({
      args: {
        sourceGroupId: "source-group-1",
        baseUrl: "http://localhost:8081",
        maxScrolls: 3,
        maxDurationMs: 30_000,
        diagnoseCheckout: false,
      },
      logger,
      dependencies: {
        profileLeasePort,
        payloadCapturePort,
        submitCapturedPayloadUseCase: new FakeSubmissionUseCase(),
        sourceGroupResolver,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatchObject({
      code: "SOURCE_GROUP_NOT_ACTIVE",
    });
    expect(profileLeasePort.checkoutCalls).toEqual([]);
    expect(payloadCapturePort.calls).toEqual([]);
  });

  it("returns a clear safe error for missing source groups", async () => {
    const profileLeasePort = new FakeProfileLeasePort();
    const payloadCapturePort = new FakeCapturePort();
    const sourceGroupResolver = new FakeSourceGroupResolver({
      result: {
        ok: false,
        statusCode: 404,
        errorCode: "SOURCE_GROUP_NOT_FOUND",
        errorMessage: "Source group not found.",
      },
    });

    const result = await runFacebookCollectorCommand({
      args: {
        sourceGroupId: "missing-source-group",
        baseUrl: "http://localhost:8081",
        maxScrolls: 3,
        maxDurationMs: 30_000,
        diagnoseCheckout: false,
      },
      dependencies: {
        profileLeasePort,
        payloadCapturePort,
        submitCapturedPayloadUseCase: new FakeSubmissionUseCase(),
        sourceGroupResolver,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      sourceGroupId: "missing-source-group",
      errors: [
        {
          code: "SOURCE_GROUP_NOT_FOUND",
          causeCode: "SOURCE_GROUP_NOT_FOUND",
          statusCode: 404,
        },
      ],
    });
    expect(result.errors[0]?.message).toContain("missing-source-group");
    expect(profileLeasePort.checkoutCalls).toEqual([]);
    expect(payloadCapturePort.calls).toEqual([]);
  });

  it("prints safe checkout hints for no eligible profile failures", async () => {
    const profileLeasePort = new FakeProfileLeasePort();
    const logger = new MemoryLogger();

    profileLeasePort.checkoutResult = {
      ok: false,
      statusCode: 404,
      errorCode: "NO_ELIGIBLE_PROFILE_AVAILABLE",
      errorMessage: "No checkout-eligible collector profile is available.",
    };

    const result = await runFacebookCollectorCommand({
      args: {
        sourceGroupId: "source-group-1",
        baseUrl: "http://localhost:8081",
        maxScrolls: 3,
        maxDurationMs: 30_000,
        diagnoseCheckout: false,
      },
      logger,
      dependencies: {
        profileLeasePort,
        payloadCapturePort: new FakeCapturePort(),
        submitCapturedPayloadUseCase: new FakeSubmissionUseCase(),
        sourceGroupResolver: new FakeSourceGroupResolver(),
      },
    });

    expect(result.ok).toBe(false);

    const output = logger.messages.join("\n");

    expect(output).toContain("NO_ELIGIBLE_PROFILE_AVAILABLE");
    expect(output).toContain("No profile is READY in this API/database.");
    expect(output).toContain("temporal routine");
    expect(output).toContain("Cooldown or safety thresholds");
    expect(output).toContain("leased or BUSY");
    expect(output).toContain("different stack than the Web UI");
    expect(output).not.toContain("session-cookie-value");
    expect(output).not.toContain("proxy-password");
  });

  it("prints only safe aggregate profile counts in diagnostic mode", async () => {
    const logger = new MemoryLogger();

    await runFacebookCollectorCommand({
      args: {
        sourceGroupId: "source-group-1",
        baseUrl: "http://localhost:8081",
        maxScrolls: 3,
        maxDurationMs: 30_000,
        diagnoseCheckout: true,
      },
      logger,
      dependencies: {
        profileLeasePort: new FakeProfileLeasePort(),
        payloadCapturePort: new FakeCapturePort(),
        submitCapturedPayloadUseCase: new FakeSubmissionUseCase(),
        sourceGroupResolver: new FakeSourceGroupResolver(),
        checkoutDiagnosticsPort: new FakeCheckoutDiagnosticsPort(),
      },
    });

    const output = logger.messages.join("\n");

    expect(output).toContain("Total profiles: 4");
    expect(output).toContain("READY: 1");
    expect(output).toContain("BUSY: 1");
    expect(output).toContain("PENDING_LOGIN: 1");
    expect(output).toContain("PENDING_CONFIG: 1");
    expect(output).not.toContain("profile-1");
    expect(output).not.toContain("session-cookie-value");
    expect(output).not.toContain("proxy-password");
  });
});

class FakeProfileLeasePort implements ProfileLeasePort {
  public readonly checkoutCalls: ProfileCheckoutInput[] = [];
  public readonly releaseCalls: ProfileLeaseReleaseInput[] = [];
  public checkoutResult: ProfileCheckoutResult = {
    ok: true,
    profileId: "profile-1",
    leaseId: "lease-1",
    leaseExpiresAt: "2026-06-10T12:30:00.000Z",
  };

  public async checkoutProfile(
    input: ProfileCheckoutInput,
  ): Promise<ProfileCheckoutResult> {
    this.checkoutCalls.push(input);

    return this.checkoutResult;
  }

  public async releaseProfileLease(
    input: ProfileLeaseReleaseInput,
  ): Promise<ProfileLeaseReleaseResult> {
    this.releaseCalls.push(input);

    return {
      ok: true,
      releasedAt: "2026-06-10T12:05:00.000Z",
    };
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
          capturedAt: new Date("2026-06-10T12:00:00.000Z"),
          payload: {
            rawGraphQLPayload: "session-cookie-value",
          },
          sourceUrlHint: "https://www.facebook.com/api/graphql/",
        },
      ],
      warnings: [
        {
          code: "CAPTURE_SETTLED",
          message: "Capture settled before timeout.",
        },
      ],
    };
  }
}

class FakeSubmissionUseCase implements CapturedFacebookPayloadSubmissionUseCase {
  public readonly calls: SubmitCapturedFacebookPayloadInput[] = [];
  public result: SubmitCapturedFacebookPayloadResult = {
    ok: true,
    extractedCandidateCount: 2,
    submittedCount: 2,
    failedSubmissionCount: 0,
    warnings: [],
    submissions: [
      {
        externalPostId: "post-1",
        ok: true,
        statusCode: 201,
        contentItemId: "content-1",
      },
      {
        externalPostId: "post-2",
        ok: true,
        statusCode: 201,
        contentItemId: "content-2",
      },
    ],
  };

  public async execute(
    input: SubmitCapturedFacebookPayloadInput,
  ): Promise<SubmitCapturedFacebookPayloadResult> {
    this.calls.push(input);

    return this.result;
  }
}

class FakeSourceGroupResolver implements FacebookCollectorSourceGroupResolver {
  public readonly calls: string[] = [];
  private readonly result: ContentManagerSourceGroupLookupResult;

  public constructor(
    options: {
      readonly result?: ContentManagerSourceGroupLookupResult;
      readonly sourceGroup?: ContentManagerSourceGroup;
    } = {},
  ) {
    this.result =
      options.result ??
      ({
        ok: true,
        statusCode: 200,
        sourceGroup: options.sourceGroup ?? {
          id: "source-group-1",
          platform: "FACEBOOK",
          status: "ACTIVE",
          url: "https://www.facebook.com/groups/group-1",
        },
      } satisfies ContentManagerSourceGroupLookupResult);
  }

  public async getSourceGroup(
    sourceGroupId: string,
  ): Promise<ContentManagerSourceGroupLookupResult> {
    this.calls.push(sourceGroupId);

    return this.result;
  }
}

class FakeCheckoutDiagnosticsPort
  implements FacebookCollectorCheckoutDiagnosticsPort {
  public async getSafeProfileStatusCounts(): Promise<SafeProfileStatusCountsResult> {
    return {
      ok: true,
      counts: {
        total: 4,
        READY: 1,
        BUSY: 1,
        PENDING_LOGIN: 1,
        PENDING_CONFIG: 1,
      },
    };
  }
}

class MemoryLogger implements FacebookCollectorLogger {
  public readonly messages: string[] = [];

  public info(message: string): void {
    this.messages.push(message);
  }

  public warn(message: string): void {
    this.messages.push(message);
  }

  public error(message: string): void {
    this.messages.push(message);
  }
}
