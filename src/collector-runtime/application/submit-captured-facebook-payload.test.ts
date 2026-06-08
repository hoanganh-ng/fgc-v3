import { describe, expect, it } from "vitest";
import { validateCollectedContentInput } from "../../content-manager/domain";
import {
  syntheticCommentsAndCountsPayload,
  syntheticUnsupportedPayload,
  syntheticValidGroupPostPayload,
} from "../platform-extractors/facebook/__fixtures__";
import { SubmitCapturedFacebookPayloadUseCase } from "./submit-captured-facebook-payload";
import type {
  CollectedContentSubmissionInput,
  ContentManagerContentSubmissionPort,
  ContentSubmissionResult,
  SubmitCapturedFacebookPayloadInput,
} from "./collector-runtime.types";

const sourceGroupId = "source-group-1";
const capturedAt = new Date("2026-03-01T12:00:00.000Z");

describe("SubmitCapturedFacebookPayloadUseCase", () => {
  it("submits extractor candidates to the Content Manager submission port", async () => {
    const port = new FakeContentSubmissionPort();
    const result = await executeWithPort(port, {
      payload: syntheticValidGroupPostPayload,
    });

    expect(result).toMatchObject({
      ok: true,
      extractedCandidateCount: 1,
      submittedCount: 1,
      failedSubmissionCount: 0,
      submissions: [
        {
          externalPostId: "post-123",
          ok: true,
          statusCode: 200,
          contentItemId: "content-post-123",
        },
      ],
    });
    expect(port.calls).toHaveLength(1);
    expect(port.calls[0]).toMatchObject({
      platform: "FACEBOOK",
      sourceGroupId,
      externalPostId: "post-123",
      sourceUrl: "https://www.facebook.com/groups/group-1/posts/post-123/",
      collectedAt: "2026-03-01T12:00:00.000Z",
    });
  });

  it("returns success with zero submissions when extraction finds no candidates", async () => {
    const port = new FakeContentSubmissionPort();
    const result = await executeWithPort(port, {
      payload: syntheticUnsupportedPayload,
    });

    expect(result).toMatchObject({
      ok: true,
      extractedCandidateCount: 0,
      submittedCount: 0,
      failedSubmissionCount: 0,
      submissions: [],
    });
    expect(result.ok && result.warnings.map((warning) => warning.code)).toContain(
      "UNSUPPORTED_PAYLOAD_SHAPE",
    );
    expect(port.calls).toEqual([]);
  });

  it("returns a failed result when extraction input is invalid", async () => {
    const port = new FakeContentSubmissionPort();
    const result = await executeWithPort(port, {
      sourceGroupId: " ",
      capturedAt: new Date("invalid"),
      payload: syntheticValidGroupPostPayload,
    });

    expect(result).toMatchObject({
      ok: false,
      extractedCandidateCount: 0,
      submittedCount: 0,
      failedSubmissionCount: 0,
    });
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(["INVALID_SOURCE_GROUP_ID", "INVALID_CAPTURED_AT"]),
      );
    }

    expect(port.calls).toEqual([]);
  });

  it("preserves warnings from the extractor", async () => {
    const port = new FakeContentSubmissionPort();
    const result = await executeWithPort(port, {
      payload: syntheticCommentsAndCountsPayload,
      sourceUrlHint:
        "https://www.facebook.com/groups/group-1/posts/post-with-comments/",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.warnings.map((warning) => warning.code)).toEqual(
        expect.arrayContaining([
          "MISSING_OPTIONAL_AUTHOR",
          "MISSING_POSTED_AT",
          "SKIPPED_COMMENT_WITHOUT_BODY_TEXT",
          "SKIPPED_COMMENT_WITHOUT_ID",
        ]),
      );
    }
  });

  it("reports partial submission failures while attempting every candidate", async () => {
    const port = new FakeContentSubmissionPort();

    port.setResult("post-b", {
      ok: false,
      statusCode: 409,
      errorCode: "CONTENT_MANAGER_HTTP_ERROR",
      errorMessage: "Duplicate content item.",
    });

    const result = await executeWithPort(port, {
      payload: syntheticTwoPostPayload,
    });

    expect(port.calls.map((call) => call.externalPostId)).toEqual([
      "post-a",
      "post-b",
    ]);
    expect(result).toMatchObject({
      ok: true,
      extractedCandidateCount: 2,
      submittedCount: 1,
      failedSubmissionCount: 1,
      submissions: [
        {
          externalPostId: "post-a",
          ok: true,
        },
        {
          externalPostId: "post-b",
          ok: false,
          statusCode: 409,
          errorCode: "CONTENT_MANAGER_HTTP_ERROR",
        },
      ],
    });
  });

  it("records thrown port failures and continues submitting later candidates", async () => {
    const port = new FakeContentSubmissionPort();

    port.setThrownError("post-a", new Error("Port failed unexpectedly."));

    const result = await executeWithPort(port, {
      payload: syntheticTwoPostPayload,
    });

    expect(port.calls.map((call) => call.externalPostId)).toEqual([
      "post-a",
      "post-b",
    ]);
    expect(result).toMatchObject({
      ok: true,
      extractedCandidateCount: 2,
      submittedCount: 1,
      failedSubmissionCount: 1,
      submissions: [
        {
          externalPostId: "post-a",
          ok: false,
          errorCode: "SUBMISSION_PORT_ERROR",
          errorMessage: "Port failed unexpectedly.",
        },
        {
          externalPostId: "post-b",
          ok: true,
        },
      ],
    });
  });

  it("keeps candidate datetime strings compatible with Content Manager ingestion", async () => {
    const port = new FakeContentSubmissionPort();

    await executeWithPort(port, {
      payload: syntheticValidGroupPostPayload,
    });

    const submitted = onlyCall(port);

    expect(submitted.collectedAt).toBe("2026-03-01T12:00:00.000Z");
    expect(submitted.postedAt).toBe("2026-02-03T10:15:00.000Z");
    expect(submitted.topComments[0]?.postedAt).toBe(
      "2026-02-03T10:20:00.000Z",
    );
    expect(validateCollectedContentInput(submitted)).toEqual({
      valid: true,
      value: submitted,
    });
  });

  it("does not send the raw GraphQL payload to the submission port", async () => {
    const port = new FakeContentSubmissionPort();

    await executeWithPort(port, {
      payload: {
        rawFacebookGraphqlPayload: "must not be forwarded",
        ...syntheticValidGroupPostPayload,
      },
    });

    const submitted = onlyCall(port);

    expect(submitted).not.toHaveProperty("payload");
    expect(submitted).not.toHaveProperty("rawFacebookGraphqlPayload");
    expect(submitted).not.toHaveProperty("rawGraphQLPayload");
    expect(submitted).not.toHaveProperty("rawPayload");
  });
});

class FakeContentSubmissionPort implements ContentManagerContentSubmissionPort {
  public readonly calls: CollectedContentSubmissionInput[] = [];
  private readonly results = new Map<string, ContentSubmissionResult>();
  private readonly thrownErrors = new Map<string, unknown>();

  public setResult(
    externalPostId: string,
    result: ContentSubmissionResult,
  ): void {
    this.results.set(externalPostId, result);
  }

  public setThrownError(externalPostId: string, error: unknown): void {
    this.thrownErrors.set(externalPostId, error);
  }

  public async submitCollectedContent(
    input: CollectedContentSubmissionInput,
  ): Promise<ContentSubmissionResult> {
    this.calls.push(input);

    const thrownError = this.thrownErrors.get(input.externalPostId);

    if (thrownError !== undefined) {
      throw thrownError;
    }

    return (
      this.results.get(input.externalPostId) ?? {
        ok: true,
        statusCode: 200,
        contentItemId: `content-${input.externalPostId}`,
      }
    );
  }
}

async function executeWithPort(
  port: ContentManagerContentSubmissionPort,
  input: Partial<SubmitCapturedFacebookPayloadInput>,
) {
  const useCase = new SubmitCapturedFacebookPayloadUseCase({
    contentSubmissionPort: port,
  });

  return useCase.execute({
    sourceGroupId: input.sourceGroupId ?? sourceGroupId,
    capturedAt: input.capturedAt ?? capturedAt,
    payload: input.payload ?? syntheticValidGroupPostPayload,
    ...(input.sourceUrlHint !== undefined
      ? { sourceUrlHint: input.sourceUrlHint }
      : {}),
  });
}

function onlyCall(
  port: FakeContentSubmissionPort,
): CollectedContentSubmissionInput {
  expect(port.calls).toHaveLength(1);

  const submitted = port.calls[0];

  if (submitted === undefined) {
    throw new Error("Expected one submitted candidate.");
  }

  return submitted;
}

const syntheticTwoPostPayload = {
  data: {
    group_feed: {
      edges: [
        {
          node: {
            __typename: "GroupPostStory",
            post_id: "post-a",
            url: "https://www.facebook.com/groups/group-1/posts/post-a/",
            message: {
              text: "First post ready for submission.",
            },
            creation_time: "2026-02-03T11:00:00.000Z",
            feedback: {
              reaction_count: {
                count: 4,
              },
              comment_count: {
                total_count: 1,
              },
            },
          },
        },
        {
          node: {
            __typename: "GroupPostStory",
            post_id: "post-b",
            url: "https://www.facebook.com/groups/group-1/posts/post-b/",
            message: {
              text: "Second post should still be attempted.",
            },
            creation_time: "2026-02-03T12:00:00.000Z",
            feedback: {
              reaction_count: {
                count: 7,
              },
              comment_count: {
                total_count: 2,
              },
            },
          },
        },
      ],
    },
  },
} as const;
