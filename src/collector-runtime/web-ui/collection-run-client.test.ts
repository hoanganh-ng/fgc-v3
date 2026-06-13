import { describe, expect, it } from "vitest";
import { z } from "zod";

const now = "2026-06-14T00:00:00Z";

// ── Schema definitions duplicated for isolation from web @/ alias ──

const CollectionRunStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
]);

const CollectionRunTriggerTypeSchema = z.enum(["MANUAL_API"]);

const NonEmptyStringSchema = z.string().min(1);

const PageSchema = z
  .object({
    limit: z.number(),
    offset: z.number(),
    total: z.number().optional(),
  })
  .strict();

const CollectionRunParametersSchema = z
  .object({
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
  })
  .strict();

const CollectionRunSummarySchema = z
  .object({
    capturedPayloads: z.number().int().min(0).optional(),
    extractorCandidates: z.number().int().min(0).optional(),
    contentItemsSubmitted: z.number().int().min(0).optional(),
    failedSubmissions: z.number().int().min(0).optional(),
    leaseReleased: z.boolean().optional(),
  })
  .strict();

const CollectionRunFailureReasonSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();

const CollectionRunSchema = z
  .object({
    id: NonEmptyStringSchema,
    sourceGroupId: NonEmptyStringSchema,
    status: CollectionRunStatusSchema,
    triggerType: CollectionRunTriggerTypeSchema,
    parameters: CollectionRunParametersSchema,
    summary: CollectionRunSummarySchema.optional(),
    failureReason: CollectionRunFailureReasonSchema.optional(),
    requestedAt: z.string().datetime({ offset: true }),
    startedAt: z.string().datetime({ offset: true }).optional(),
    finishedAt: z.string().datetime({ offset: true }).optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

const CollectionRunsListResponseSchema = z
  .object({
    items: z.array(CollectionRunSchema),
    page: PageSchema,
  })
  .strict();

const CollectionRunResponseSchema = z
  .object({
    collectionRun: CollectionRunSchema,
  })
  .strict();

const RequestCollectionRunRequestSchema = z
  .object({
    sourceGroupId: NonEmptyStringSchema,
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
  })
  .strict();

// ── Query-params helper (matches collector-runtime-client.ts) ──

interface ListCollectionRunsQuery {
  readonly status?: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  readonly sourceGroupId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

function toListCollectionRunsQueryParams(
  query: ListCollectionRunsQuery | undefined,
): Readonly<Record<string, string | number>> | undefined {
  if (query === undefined) {
    return undefined;
  }

  return {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.sourceGroupId !== undefined
      ? { sourceGroupId: query.sourceGroupId }
      : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {}),
    ...(query.offset !== undefined ? { offset: query.offset } : {}),
  };
}

function createRun(
  overrides: Record<string, unknown> = {},
): z.infer<typeof CollectionRunSchema> {
  return CollectionRunSchema.parse({
    id: "run-1",
    sourceGroupId: "sg-1",
    status: "QUEUED",
    triggerType: "MANUAL_API",
    parameters: {},
    requestedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

// ── Tests ──

describe("CollectionRunStatusSchema", () => {
  it("accepts all valid statuses", () => {
    for (const status of [
      "QUEUED",
      "RUNNING",
      "SUCCEEDED",
      "FAILED",
      "CANCELED",
    ]) {
      expect(CollectionRunStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rejects invalid statuses", () => {
    expect(CollectionRunStatusSchema.safeParse("UNKNOWN")).toEqual(
      expect.objectContaining({ success: false }),
    );
  });
});

describe("CollectionRunSchema", () => {
  it("parses a minimal valid run", () => {
    const run = createRun();

    expect(run.id).toBe("run-1");
    expect(run.sourceGroupId).toBe("sg-1");
    expect(run.status).toBe("QUEUED");
    expect(run.triggerType).toBe("MANUAL_API");
    expect(run.parameters).toEqual({});
    expect(run.requestedAt).toBe(now);
    expect(run.createdAt).toBe(now);
    expect(run.updatedAt).toBe(now);
    expect(run.summary).toBeUndefined();
    expect(run.failureReason).toBeUndefined();
    expect(run.startedAt).toBeUndefined();
    expect(run.finishedAt).toBeUndefined();
  });

  it("rejects runs with missing required fields", () => {
    const result = CollectionRunSchema.safeParse({
      id: "run-1",
      sourceGroupId: "sg-1",
      status: "QUEUED",
      triggerType: "MANUAL_API",
      parameters: {},
      requestedAt: now,
      createdAt: now,
    });

    expect(result.success).toBe(false);
  });

  it("rejects runs with additional fields (strict)", () => {
    const result = CollectionRunSchema.safeParse({
      id: "run-1",
      sourceGroupId: "sg-1",
      status: "QUEUED",
      triggerType: "MANUAL_API",
      parameters: {},
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
      leakedField: "should-not-appear",
    });

    expect(result.success).toBe(false);
  });

  it("parses runs with optional summary", () => {
    const run = createRun({
      summary: {
        capturedPayloads: 5,
        extractorCandidates: 3,
        contentItemsSubmitted: 3,
        failedSubmissions: 0,
        leaseReleased: true,
      },
    });

    expect(run.summary).toEqual({
      capturedPayloads: 5,
      extractorCandidates: 3,
      contentItemsSubmitted: 3,
      failedSubmissions: 0,
      leaseReleased: true,
    });
  });

  it("parses runs with failureReason", () => {
    const run = createRun({
      status: "FAILED",
      failureReason: { code: "CHECKOUT_FAILED", message: "Lease conflict" },
      finishedAt: now,
    });

    expect(run.status).toBe("FAILED");
    expect(run.failureReason?.code).toBe("CHECKOUT_FAILED");
    expect(run.failureReason?.message).toBe("Lease conflict");
  });

  it("parses maxScrolls = 0 as valid", () => {
    const run = createRun({ parameters: { maxScrolls: 0 } });
    expect(run.parameters.maxScrolls).toBe(0);
  });

  it("parses maxScrolls and maxDurationMs together", () => {
    const run = createRun({
      parameters: { maxScrolls: 10, maxDurationMs: 30000 },
    });

    expect(run.parameters.maxScrolls).toBe(10);
    expect(run.parameters.maxDurationMs).toBe(30000);
  });

  it("rejects negative maxScrolls", () => {
    const result = CollectionRunSchema.safeParse({
      id: "run-1",
      sourceGroupId: "sg-1",
      status: "QUEUED",
      triggerType: "MANUAL_API",
      parameters: { maxScrolls: -1 },
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    expect(result.success).toBe(false);
  });

  it("rejects zero maxDurationMs", () => {
    const result = CollectionRunSchema.safeParse({
      id: "run-1",
      sourceGroupId: "sg-1",
      status: "QUEUED",
      triggerType: "MANUAL_API",
      parameters: { maxDurationMs: 0 },
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    expect(result.success).toBe(false);
  });
});

describe("CollectionRunsListResponseSchema", () => {
  it("parses an empty list response", () => {
    const result = CollectionRunsListResponseSchema.parse({
      items: [],
      page: { limit: 50, offset: 0 },
    });

    expect(result.items).toEqual([]);
    expect(result.page).toEqual({ limit: 50, offset: 0 });
    expect(result.page.total).toBeUndefined();
  });

  it("parses a list response with total", () => {
    const result = CollectionRunsListResponseSchema.parse({
      items: [createRun()],
      page: { limit: 50, offset: 0, total: 150 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.page.total).toBe(150);
  });

  it("parses multiple runs with mixed statuses", () => {
    const result = CollectionRunsListResponseSchema.parse({
      items: [
        createRun({ id: "run-1", status: "QUEUED" }),
        createRun({ id: "run-2", status: "RUNNING" }),
        createRun({ id: "run-3", status: "SUCCEEDED" }),
      ],
      page: { limit: 50, offset: 0, total: 3 },
    });

    expect(result.items).toHaveLength(3);
    expect(result.items.at(0)?.status).toBe("QUEUED");
    expect(result.items.at(1)?.status).toBe("RUNNING");
    expect(result.items.at(2)?.status).toBe("SUCCEEDED");
  });

  it("rejects response with extra fields (strict)", () => {
    const result = CollectionRunsListResponseSchema.safeParse({
      items: [],
      page: { limit: 50, offset: 0 },
      extra: "field",
    });

    expect(result.success).toBe(false);
  });
});

describe("CollectionRunResponseSchema", () => {
  it("parses a single run response", () => {
    const result = CollectionRunResponseSchema.parse({
      collectionRun: createRun({ id: "new-run" }),
    });

    expect(result.collectionRun.id).toBe("new-run");
  });

  it("rejects response with extra fields (strict)", () => {
    const result = CollectionRunResponseSchema.safeParse({
      collectionRun: createRun(),
      metadata: "extra",
    });

    expect(result.success).toBe(false);
  });
});

describe("RequestCollectionRunRequestSchema", () => {
  it("parses minimal request with only sourceGroupId", () => {
    const result = RequestCollectionRunRequestSchema.parse({
      sourceGroupId: "sg-1",
    });

    expect(result.sourceGroupId).toBe("sg-1");
    expect(result.maxScrolls).toBeUndefined();
    expect(result.maxDurationMs).toBeUndefined();
  });

  it("parses request with maxScrolls = 0", () => {
    const result = RequestCollectionRunRequestSchema.parse({
      sourceGroupId: "sg-1",
      maxScrolls: 0,
    });

    expect(result.maxScrolls).toBe(0);
  });

  it("parses request with maxScrolls and maxDurationMs", () => {
    const result = RequestCollectionRunRequestSchema.parse({
      sourceGroupId: "sg-1",
      maxScrolls: 5,
      maxDurationMs: 60000,
    });

    expect(result.maxScrolls).toBe(5);
    expect(result.maxDurationMs).toBe(60000);
  });

  it("rejects request without sourceGroupId", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects negative maxScrolls", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      maxScrolls: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects zero maxDurationMs", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      maxDurationMs: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects request with unknown fields", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      profileId: "p-1",
    });

    expect(result.success).toBe(false);
  });
});



describe("query params helper", () => {
  it("returns undefined for undefined query", () => {
    expect(toListCollectionRunsQueryParams(undefined)).toBeUndefined();
  });

  it("includes status filter when set", () => {
    const params = toListCollectionRunsQueryParams({ status: "QUEUED" });
    expect(params).toEqual({ status: "QUEUED" });
  });

  it("omits status filter when not set", () => {
    const params = toListCollectionRunsQueryParams({});
    expect(params?.status).toBeUndefined();
  });

  it("includes sourceGroupId filter when set", () => {
    const params = toListCollectionRunsQueryParams({ sourceGroupId: "sg-1" });
    expect(params).toEqual({ sourceGroupId: "sg-1" });
  });

  it("omits sourceGroupId filter when not set", () => {
    const params = toListCollectionRunsQueryParams({});
    expect(params?.sourceGroupId).toBeUndefined();
  });

  it("includes limit and offset", () => {
    const params = toListCollectionRunsQueryParams({ limit: 50, offset: 100 });
    expect(params).toEqual({ limit: 50, offset: 100 });
  });

  it("includes all filters together", () => {
    const params = toListCollectionRunsQueryParams({
      status: "RUNNING",
      sourceGroupId: "sg-special",
      limit: 10,
      offset: 20,
    });

    expect(params).toEqual({
      status: "RUNNING",
      sourceGroupId: "sg-special",
      limit: 10,
      offset: 20,
    });
  });
});

// ── Form serialization tests (blank omit, maxScrolls=0 preserved) ──

describe("request form serialization", () => {
  it("accepts minimal request with only sourceGroupId", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxScrolls).toBeUndefined();
      expect(result.data.maxDurationMs).toBeUndefined();
    }
  });

  it("preserves maxScrolls = 0 as valid", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      maxScrolls: 0,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxScrolls).toBe(0);
    }
  });

  it("accepts maxScrolls > 0", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      maxScrolls: 5,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxScrolls).toBe(5);
    }
  });

  it("accepts maxDurationMs with minimum value of 1", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      maxDurationMs: 1,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxDurationMs).toBe(1);
    }
  });

  it("rejects maxDurationMs = 0", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      maxDurationMs: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative maxScrolls", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      maxScrolls: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative maxDurationMs", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      maxDurationMs: -100,
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-integer maxScrolls", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      maxScrolls: 2.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-integer maxDurationMs", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      maxDurationMs: 100.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects requests with unknown fields (strict)", () => {
    const result = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      profileId: "p-1",
    });

    expect(result.success).toBe(false);
  });
});

