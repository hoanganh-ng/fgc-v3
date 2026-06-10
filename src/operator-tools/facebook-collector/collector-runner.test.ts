import { describe, expect, it } from "vitest";
import { runFacebookCollectorCommand } from "./collector-runner";
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
import type { FacebookCollectorLogger } from "./collector-runner";

describe("runFacebookCollectorCommand", () => {
  it("runs the existing collection use case and prints a safe count summary", async () => {
    const profileLeasePort = new FakeProfileLeasePort();
    const payloadCapturePort = new FakeCapturePort();
    const submitCapturedPayloadUseCase = new FakeSubmissionUseCase();
    const logger = new MemoryLogger();

    const result = await runFacebookCollectorCommand({
      args: {
        groupUrl: "https://www.facebook.com/groups/group-1",
        sourceGroupId: "source-group-1",
        baseUrl: "http://localhost:8081",
        maxScrolls: 3,
        maxDurationMs: 30_000,
      },
      logger,
      dependencies: {
        profileLeasePort,
        payloadCapturePort,
        submitCapturedPayloadUseCase,
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
      },
      logger,
      dependencies: {
        profileLeasePort,
        payloadCapturePort,
        submitCapturedPayloadUseCase,
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
});

class FakeProfileLeasePort implements ProfileLeasePort {
  public readonly checkoutCalls: ProfileCheckoutInput[] = [];
  public readonly releaseCalls: ProfileLeaseReleaseInput[] = [];

  public async checkoutProfile(
    input: ProfileCheckoutInput,
  ): Promise<ProfileCheckoutResult> {
    this.checkoutCalls.push(input);

    return {
      ok: true,
      profileId: "profile-1",
      leaseId: "lease-1",
      leaseExpiresAt: "2026-06-10T12:30:00.000Z",
    };
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
