import { describe, expect, it } from "vitest";
import {
  ContentCategoryNotFoundError,
  ContentValidationError,
  CreateSourceGroupUseCase,
  GetSourcePublisherUseCase,
  ListSourcePublishersUseCase,
  MAX_SOURCE_PUBLISHER_LIST_LIMIT,
  ObserveSourcePublisherUseCase,
  PromoteSourcePublisherToSourceGroupUseCase,
  SourcePublisherNotFoundError,
  SourcePublisherNotPromotableError,
  UpdateSourcePublisherStatusUseCase,
} from "./index";
import type {
  AtomicSourcePublisherObservationInput,
  Clock,
  IdGenerator,
  SourcePublisherListQuery,
  SourcePublisherListResult,
  SourcePublisherRepository,
  SourcePublisherStatusPersistenceInput,
} from "./index";
import {
  InMemoryContentCategoryRepository,
  InMemorySourceGroupRepository,
  InMemorySourcePublisherRepository,
} from "./test-support/in-memory-repositories";
import type { ContentCategory, SourcePublisher } from "../domain";

const baseObservedAt = "2026-03-01T08:00:00.000Z";
const laterObservedAt = "2026-03-01T09:00:00.000Z";
const olderObservedAt = "2026-03-01T07:30:00.000Z";
const baseUpdatedAt = "2026-03-01T08:05:00.000Z";
const laterUpdatedAt = "2026-03-01T09:05:00.000Z";

describe("source publisher application use cases", () => {
  it("observes a new source publisher with DISCOVERED status", async () => {
    const context = createTestContext(["publisher-1"]);

    const sourcePublisher = await new ObserveSourcePublisherUseCase(
      context.sourcePublishers,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: baseObservedAt,
      displayName: "Knowledge Group 1",
      canonicalUrl: "https://www.facebook.com/groups/knowledge-1",
    });

    expect(sourcePublisher).toEqual({
      id: "publisher-1",
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      displayName: "Knowledge Group 1",
      canonicalUrl: "https://www.facebook.com/groups/knowledge-1",
      status: "DISCOVERED",
      firstObservedAt: baseObservedAt,
      lastObservedAt: baseObservedAt,
      observationCount: 1,
      createdAt: baseUpdatedAt,
      updatedAt: baseUpdatedAt,
    });
    await expect(
      context.sourcePublishers.findById("publisher-1"),
    ).resolves.toEqual(sourcePublisher);
  });

  it("reuses id, identity, createdAt, firstObservedAt, and status on subsequent observations", async () => {
    const context = createTestContext(["publisher-1"]);

    await new ObserveSourcePublisherUseCase(
      context.sourcePublishers,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: baseObservedAt,
    });

    context.clock.setNow(laterUpdatedAt);

    const sourcePublisher = await new ObserveSourcePublisherUseCase(
      context.sourcePublishers,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: laterObservedAt,
      displayName: "Knowledge Group 1 (latest)",
    });

    expect(sourcePublisher.id).toBe("publisher-1");
    expect(sourcePublisher.platform).toBe("FACEBOOK");
    expect(sourcePublisher.kind).toBe("GROUP");
    expect(sourcePublisher.externalPublisherId).toBe("facebook-group-1");
    expect(sourcePublisher.createdAt).toBe(baseUpdatedAt);
    expect(sourcePublisher.firstObservedAt).toBe(baseObservedAt);
    expect(sourcePublisher.lastObservedAt).toBe(laterObservedAt);
    expect(sourcePublisher.observationCount).toBe(2);
    expect(sourcePublisher.updatedAt).toBe(laterUpdatedAt);
  });

  it("never moves lastObservedAt backward", async () => {
    const context = createTestContext(["publisher-1"]);

    await new ObserveSourcePublisherUseCase(
      context.sourcePublishers,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: laterObservedAt,
    });
    context.clock.setNow(laterUpdatedAt);

    const sourcePublisher = await new ObserveSourcePublisherUseCase(
      context.sourcePublishers,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: olderObservedAt,
    });

    expect(sourcePublisher.lastObservedAt).toBe(laterObservedAt);
    expect(sourcePublisher.observationCount).toBe(2);
  });

  it("preserves review status across observations", async () => {
    const context = createTestContext(["publisher-1"]);

    const first = await new ObserveSourcePublisherUseCase(
      context.sourcePublishers,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "PAGE",
      externalPublisherId: "facebook-page-1",
      observedAt: baseObservedAt,
    });

    expect(first.status).toBe("DISCOVERED");

    await new UpdateSourcePublisherStatusUseCase(
      context.sourcePublishers,
      context.clock,
    ).execute({
      sourcePublisherId: "publisher-1",
      status: "BLOCKED",
    });

    const second = await new ObserveSourcePublisherUseCase(
      context.sourcePublishers,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "PAGE",
      externalPublisherId: "facebook-page-1",
      observedAt: laterObservedAt,
    });

    expect(second.status).toBe("BLOCKED");
  });

  it("rejects observation input that violates the runtime schema", async () => {
    const observationRepository = new CountingSourcePublisherRepository();
    const context = createTestContext(["publisher-1"]);

    await new ObserveSourcePublisherUseCase(
      observationRepository,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: baseObservedAt,
    });

    const observeCountAfterSeed = observationRepository.observeCount;
    const seeded = (await observationRepository.findById("publisher-1"))!;

    await expect(
      new ObserveSourcePublisherUseCase(
        observationRepository,
        context.ids,
        context.clock,
      ).execute({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "facebook-group-1",
        observedAt: "not-a-timestamp",
      }),
    ).rejects.toThrow(ContentValidationError);

    const after = (await observationRepository.findById("publisher-1"))!;
    expect(after.observationCount).toBe(seeded.observationCount);
    expect(after.observationCount).toBe(1);
    expect(observationRepository.observeCount).toBe(observeCountAfterSeed);
  });

  it("rejects unknown kind on observation", async () => {
    const context = createTestContext(["publisher-1"]);

    await expect(
      new ObserveSourcePublisherUseCase(
        context.sourcePublishers,
        context.ids,
        context.clock,
      ).execute({
        platform: "FACEBOOK",
        kind: "UNKNOWN" as SourcePublisher["kind"],
        externalPublisherId: "facebook-group-1",
        observedAt: baseObservedAt,
      }),
    ).rejects.toThrow(ContentValidationError);
  });

  it("gets a source publisher by id", async () => {
    const context = createTestContext(["publisher-1"]);

    const observed = await new ObserveSourcePublisherUseCase(
      context.sourcePublishers,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: baseObservedAt,
    });

    await expect(
      new GetSourcePublisherUseCase(
        context.sourcePublishers,
      ).execute({ sourcePublisherId: "publisher-1" }),
    ).resolves.toEqual(observed);
  });

  it("throws SourcePublisherNotFoundError when the id is unknown", async () => {
    const context = createTestContext();

    await expect(
      new GetSourcePublisherUseCase(
        context.sourcePublishers,
      ).execute({ sourcePublisherId: "missing" }),
    ).rejects.toThrow(SourcePublisherNotFoundError);
  });

  it("updates status and bumps updatedAt", async () => {
    const context = createTestContext(["publisher-1"]);

    await new ObserveSourcePublisherUseCase(
      context.sourcePublishers,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: baseObservedAt,
    });
    context.clock.setNow(laterUpdatedAt);

    const updated = await new UpdateSourcePublisherStatusUseCase(
      context.sourcePublishers,
      context.clock,
    ).execute({
      sourcePublisherId: "publisher-1",
      status: "APPROVED",
    });

    expect(updated.status).toBe("APPROVED");
    expect(updated.updatedAt).toBe(laterUpdatedAt);
  });

  it("is idempotent when reapplying the current status", async () => {
    const context = createTestContext(["publisher-1"]);
    const statusRepository = new CountingSourcePublisherRepository();

    await new ObserveSourcePublisherUseCase(
      statusRepository,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: baseObservedAt,
    });

    await new UpdateSourcePublisherStatusUseCase(
      statusRepository,
      context.clock,
    ).execute({
      sourcePublisherId: "publisher-1",
      status: "APPROVED",
    });

    const updatedAtBefore = (await statusRepository.findById("publisher-1"))!
      .updatedAt;
    const updateStatusCountBefore = statusRepository.updateStatusCount;
    context.clock.setNow(laterUpdatedAt);

    const updated = await new UpdateSourcePublisherStatusUseCase(
      statusRepository,
      context.clock,
    ).execute({
      sourcePublisherId: "publisher-1",
      status: "APPROVED",
    });

    expect(updated.updatedAt).toBe(updatedAtBefore);
    expect(updated).toEqual(
      await statusRepository.findById("publisher-1"),
    );
    expect(statusRepository.updateStatusCount).toBe(updateStatusCountBefore);
  });

  it("calls updateStatus exactly once on a real status change", async () => {
    const context = createTestContext(["publisher-1"]);
    const statusRepository = new CountingSourcePublisherRepository();

    await new ObserveSourcePublisherUseCase(
      statusRepository,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: baseObservedAt,
    });

    const updateStatusCountAfterObserve = statusRepository.updateStatusCount;
    context.clock.setNow(laterUpdatedAt);

    await new UpdateSourcePublisherStatusUseCase(
      statusRepository,
      context.clock,
    ).execute({
      sourcePublisherId: "publisher-1",
      status: "APPROVED",
    });

    expect(statusRepository.updateStatusCount).toBe(
      updateStatusCountAfterObserve + 1,
    );
  });

  it("throws SourcePublisherNotFoundError when updating a missing publisher", async () => {
    const context = createTestContext();

    await expect(
      new UpdateSourcePublisherStatusUseCase(
        context.sourcePublishers,
        context.clock,
      ).execute({ sourcePublisherId: "missing", status: "APPROVED" }),
    ).rejects.toThrow(SourcePublisherNotFoundError);
  });

  it("rejects an invalid runtime status before updateStatus is called", async () => {
    const statusRepository = new CountingSourcePublisherRepository();
    const context = createTestContext(["publisher-1"]);

    await new ObserveSourcePublisherUseCase(
      statusRepository,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: baseObservedAt,
    });

    const updateStatusCountBefore = statusRepository.updateStatusCount;

    await expect(
      new UpdateSourcePublisherStatusUseCase(
        statusRepository,
        context.clock,
      ).execute({
        sourcePublisherId: "publisher-1",
        status: "UNKNOWN" as SourcePublisher["status"],
      }),
    ).rejects.toThrow(ContentValidationError);

    expect(statusRepository.updateStatusCount).toBe(updateStatusCountBefore);
  });

  it("rejects a malformed aggregate returned by updateStatus", async () => {
    const malformedRepository = new MalformedUpdateStatusSourcePublisherRepository();
    const context = createTestContext(["publisher-1"]);

    await new ObserveSourcePublisherUseCase(
      malformedRepository,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: baseObservedAt,
    });

    await expect(
      new UpdateSourcePublisherStatusUseCase(
        malformedRepository,
        context.clock,
      ).execute({
        sourcePublisherId: "publisher-1",
        status: "APPROVED",
      }),
    ).rejects.toThrow(ContentValidationError);
  });

  it("lists with status, kind, and platform filters plus pagination ordered by lastObservedAt desc, id asc", async () => {
    const context = createTestContext([
      "publisher-a",
      "publisher-b",
      "publisher-c",
      "publisher-d",
    ]);

    context.sourcePublishers.seedForTest({
      id: "publisher-a",
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-a",
      status: "DISCOVERED",
      firstObservedAt: "2026-03-01T08:00:00.000Z",
      lastObservedAt: "2026-03-01T08:00:00.000Z",
      observationCount: 1,
      createdAt: "2026-03-01T08:00:00.000Z",
      updatedAt: "2026-03-01T08:00:00.000Z",
    });
    context.sourcePublishers.seedForTest({
      id: "publisher-b",
      platform: "FACEBOOK",
      kind: "PAGE",
      externalPublisherId: "facebook-page-b",
      status: "DISCOVERED",
      firstObservedAt: "2026-03-02T08:00:00.000Z",
      lastObservedAt: "2026-03-02T09:00:00.000Z",
      observationCount: 1,
      createdAt: "2026-03-02T08:00:00.000Z",
      updatedAt: "2026-03-02T09:00:00.000Z",
    });
    context.sourcePublishers.seedForTest({
      id: "publisher-c",
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-c",
      status: "APPROVED",
      firstObservedAt: "2026-03-03T08:00:00.000Z",
      lastObservedAt: "2026-03-03T09:00:00.000Z",
      observationCount: 1,
      createdAt: "2026-03-03T08:00:00.000Z",
      updatedAt: "2026-03-03T09:00:00.000Z",
    });
    context.sourcePublishers.seedForTest({
      id: "publisher-d",
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-d",
      status: "APPROVED",
      firstObservedAt: "2026-03-04T08:00:00.000Z",
      lastObservedAt: "2026-03-04T09:00:00.000Z",
      observationCount: 1,
      createdAt: "2026-03-04T08:00:00.000Z",
      updatedAt: "2026-03-04T09:00:00.000Z",
    });

    const pageOne = await new ListSourcePublishersUseCase(
      context.sourcePublishers,
    ).execute({
      kind: "GROUP",
      status: "APPROVED",
      limit: 1,
      offset: 0,
    });

    expect(pageOne.items.map((item) => item.id)).toEqual(["publisher-d"]);
    expect(pageOne.page).toEqual({ limit: 1, offset: 0, total: 2 });

    const pageTwo = await new ListSourcePublishersUseCase(
      context.sourcePublishers,
    ).execute({
      kind: "GROUP",
      status: "APPROVED",
      limit: 1,
      offset: 1,
    });

    expect(pageTwo.items.map((item) => item.id)).toEqual(["publisher-c"]);
  });

  it("clamps list limit to the maximum and rejects invalid pagination", async () => {
    const context = createTestContext();

    await expect(
      new ListSourcePublishersUseCase(context.sourcePublishers).execute({
        limit: MAX_SOURCE_PUBLISHER_LIST_LIMIT + 1,
      }),
    ).resolves.toMatchObject({
      page: { limit: MAX_SOURCE_PUBLISHER_LIST_LIMIT },
    });

    await expect(
      new ListSourcePublishersUseCase(context.sourcePublishers).execute({
        limit: 0,
      }),
    ).rejects.toThrow(ContentValidationError);

    await expect(
      new ListSourcePublishersUseCase(context.sourcePublishers).execute({
        offset: -1,
      }),
    ).rejects.toThrow(ContentValidationError);
  });

  it("rejects invalid status, kind, and platform filters at runtime", async () => {
    const context = createTestContext();

    await expect(
      new ListSourcePublishersUseCase(context.sourcePublishers).execute({
        status: "UNKNOWN" as SourcePublisher["status"],
      }),
    ).rejects.toThrow(ContentValidationError);

    await expect(
      new ListSourcePublishersUseCase(context.sourcePublishers).execute({
        kind: "UNKNOWN" as SourcePublisher["kind"],
      }),
    ).rejects.toThrow(ContentValidationError);

    await expect(
      new ListSourcePublishersUseCase(context.sourcePublishers).execute({
        platform: "TWITTER" as SourcePublisher["platform"],
      }),
    ).rejects.toThrow(ContentValidationError);
  });

  it("validates repository outputs through the runtime schema", async () => {
    const context = createTestContext();
    context.sourcePublishers.seedForTest({
      id: "publisher-invalid",
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      status: "DISCOVERED",
      firstObservedAt: baseObservedAt,
      lastObservedAt: olderObservedAt,
      observationCount: 1,
      createdAt: baseUpdatedAt,
      updatedAt: baseUpdatedAt,
    });

    await expect(
      new ListSourcePublishersUseCase(context.sourcePublishers).execute(),
    ).rejects.toThrow(ContentValidationError);

    await expect(
      new GetSourcePublisherUseCase(context.sourcePublishers).execute({
        sourcePublisherId: "publisher-invalid",
      }),
    ).rejects.toThrow(ContentValidationError);
  });

  describe("observation input validation", () => {
    it("rejects invalid observation input before observeAtomically is called", async () => {
      const stub = new CountingObservationSourcePublisherRepository();
      const context = createTestContext();

      await expect(
        new ObserveSourcePublisherUseCase(
          stub,
          context.ids,
          context.clock,
        ).execute({
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "facebook-group-1",
          observedAt: "not-a-timestamp",
        }),
      ).rejects.toThrow(ContentValidationError);

      expect(stub.observeCount).toBe(0);
    });

    it("rejects a blank displayName before observeAtomically is called", async () => {
      const stub = new CountingObservationSourcePublisherRepository();
      const context = createTestContext();

      await expect(
        new ObserveSourcePublisherUseCase(
          stub,
          context.ids,
          context.clock,
        ).execute({
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "facebook-group-1",
          observedAt: baseObservedAt,
          displayName: "   ",
        }),
      ).rejects.toThrow(ContentValidationError);

      expect(stub.observeCount).toBe(0);
    });

    it("rejects an invalid canonicalUrl before observeAtomically is called", async () => {
      const stub = new CountingObservationSourcePublisherRepository();
      const context = createTestContext();

      await expect(
        new ObserveSourcePublisherUseCase(
          stub,
          context.ids,
          context.clock,
        ).execute({
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "facebook-group-1",
          observedAt: baseObservedAt,
          canonicalUrl: "not-a-url",
        }),
      ).rejects.toThrow(ContentValidationError);

      expect(stub.observeCount).toBe(0);
    });

    it("rejects unknown observation input fields at runtime", async () => {
      const stub = new CountingObservationSourcePublisherRepository();
      const context = createTestContext();

      await expect(
        new ObserveSourcePublisherUseCase(
          stub,
          context.ids,
          context.clock,
        ).execute({
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "facebook-group-1",
          observedAt: baseObservedAt,
          leakedField: "nope",
        } as unknown as Parameters<
          ObserveSourcePublisherUseCase["execute"]
        >[0]),
      ).rejects.toThrow(ContentValidationError);

      expect(stub.observeCount).toBe(0);
    });

    it("rejects null optional observation metadata (omission only)", async () => {
      const stub = new CountingObservationSourcePublisherRepository();
      const context = createTestContext();

      await expect(
        new ObserveSourcePublisherUseCase(
          stub,
          context.ids,
          context.clock,
        ).execute({
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "facebook-group-1",
          observedAt: baseObservedAt,
          displayName: null,
        } as unknown as Parameters<
          ObserveSourcePublisherUseCase["execute"]
        >[0]),
      ).rejects.toThrow(ContentValidationError);

      expect(stub.observeCount).toBe(0);
    });

    it("rejects invalid observedAt for an existing publisher without bumping count", async () => {
      const observationRepository = new CountingSourcePublisherRepository();
      const context = createTestContext(["publisher-1"]);

      await new ObserveSourcePublisherUseCase(
        observationRepository,
        context.ids,
        context.clock,
      ).execute({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "facebook-group-1",
        observedAt: baseObservedAt,
      });

      const observeCountAfterSeed = observationRepository.observeCount;
      const seeded = (await observationRepository.findById("publisher-1"))!;

      await expect(
        new ObserveSourcePublisherUseCase(
          observationRepository,
          context.ids,
          context.clock,
        ).execute({
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "facebook-group-1",
          observedAt: "not-a-timestamp",
        }),
      ).rejects.toThrow(ContentValidationError);

      const after = (await observationRepository.findById("publisher-1"))!;
      expect(after.observationCount).toBe(seeded.observationCount);
      expect(after.observationCount).toBe(1);
      expect(after.lastObservedAt).toBe(seeded.lastObservedAt);
      expect(observationRepository.observeCount).toBe(observeCountAfterSeed);
    });

    it("rejects an older observation with an invalid canonicalUrl", async () => {
      const context = createTestContext(["publisher-1"]);

      await new ObserveSourcePublisherUseCase(
        context.sourcePublishers,
        context.ids,
        context.clock,
      ).execute({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "facebook-group-1",
        observedAt: laterObservedAt,
        displayName: "Latest Display Name",
        canonicalUrl: "https://www.facebook.com/groups/latest",
      });

      await expect(
        new ObserveSourcePublisherUseCase(
          context.sourcePublishers,
          context.ids,
          context.clock,
        ).execute({
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "facebook-group-1",
          observedAt: olderObservedAt,
          canonicalUrl: "not-a-url",
        }),
      ).rejects.toThrow(ContentValidationError);

      const after = (await context.sourcePublishers.findById("publisher-1"))!;
      expect(after.canonicalUrl).toBe(
        "https://www.facebook.com/groups/latest",
      );
      expect(after.lastObservedAt).toBe(laterObservedAt);
      expect(after.observationCount).toBe(1);
    });

    it("rejects an older observation with a blank displayName", async () => {
      const context = createTestContext(["publisher-1"]);

      await new ObserveSourcePublisherUseCase(
        context.sourcePublishers,
        context.ids,
        context.clock,
      ).execute({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "facebook-group-1",
        observedAt: laterObservedAt,
        displayName: "Latest Display Name",
      });

      await expect(
        new ObserveSourcePublisherUseCase(
          context.sourcePublishers,
          context.ids,
          context.clock,
        ).execute({
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "facebook-group-1",
          observedAt: olderObservedAt,
          displayName: "   ",
        }),
      ).rejects.toThrow(ContentValidationError);

      const after = (await context.sourcePublishers.findById("publisher-1"))!;
      expect(after.displayName).toBe("Latest Display Name");
      expect(after.lastObservedAt).toBe(laterObservedAt);
      expect(after.observationCount).toBe(1);
    });

    it("replaces metadata and increments count when observedAt equals lastObservedAt", async () => {
      const context = createTestContext(["publisher-1"]);

      await new ObserveSourcePublisherUseCase(
        context.sourcePublishers,
        context.ids,
        context.clock,
      ).execute({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "facebook-group-1",
        observedAt: baseObservedAt,
        displayName: "Original Display Name",
        canonicalUrl: "https://www.facebook.com/groups/original",
      });
      context.clock.setNow(laterUpdatedAt);

      const merged = await new ObserveSourcePublisherUseCase(
        context.sourcePublishers,
        context.ids,
        context.clock,
      ).execute({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "facebook-group-1",
        observedAt: baseObservedAt,
        displayName: "Equal-Timestamp Display Name",
        canonicalUrl: "https://www.facebook.com/groups/equal",
      });

      expect(merged.displayName).toBe("Equal-Timestamp Display Name");
      expect(merged.canonicalUrl).toBe(
        "https://www.facebook.com/groups/equal",
      );
      expect(merged.lastObservedAt).toBe(baseObservedAt);
      expect(merged.observationCount).toBe(2);
      expect(merged.updatedAt).toBe(laterUpdatedAt);
    });
  });
});

describe("PromoteSourcePublisherToSourceGroupUseCase", () => {
  const seededBaseUpdatedAt = "2026-03-01T08:05:00.000Z";

  function createPromoteContext(
    ids: readonly string[] = [],
  ): PromoteTestContext {
    return {
      sourcePublishers: new InMemorySourcePublisherRepository(),
      sourceGroups: new InMemorySourceGroupRepository(),
      categories: new InMemoryContentCategoryRepository(),
      ids: new FakeIdGenerator(ids),
      clock: new FixedClock(seededBaseUpdatedAt),
    };
  }

  async function seedCategory(
    categories: InMemoryContentCategoryRepository,
  ): Promise<ContentCategory> {
    const category: ContentCategory = {
      id: "category-1",
      name: "Knowledge",
      slug: "knowledge",
      createdAt: seededBaseUpdatedAt,
      updatedAt: seededBaseUpdatedAt,
    };

    await categories.save(category);

    return category;
  }

  async function seedApprovedGroupPublisher(
    context: PromoteTestContext,
    overrides: Partial<SourcePublisher> = {},
  ): Promise<SourcePublisher> {
    const hasDisplayNameOverride = Object.prototype.hasOwnProperty.call(
      overrides,
      "displayName",
    );
    const hasCanonicalUrlOverride = Object.prototype.hasOwnProperty.call(
      overrides,
      "canonicalUrl",
    );
    const publisher: SourcePublisher = {
      id: overrides.id ?? "publisher-1",
      platform: overrides.platform ?? "FACEBOOK",
      kind: overrides.kind ?? "GROUP",
      externalPublisherId:
        overrides.externalPublisherId ?? "synthetic-group-123",
      ...(hasDisplayNameOverride
        ? { displayName: overrides.displayName as string | undefined }
        : { displayName: "Synthetic Knowledge Group" }),
      ...(hasCanonicalUrlOverride
        ? { canonicalUrl: overrides.canonicalUrl as string | undefined }
        : {
            canonicalUrl:
              "https://www.facebook.com/groups/synthetic-group-123",
          }),
      status: overrides.status ?? "APPROVED",
      firstObservedAt: overrides.firstObservedAt ?? "2026-03-01T08:00:00.000Z",
      lastObservedAt: overrides.lastObservedAt ?? "2026-03-01T08:00:00.000Z",
      observationCount: overrides.observationCount ?? 1,
      createdAt: overrides.createdAt ?? seededBaseUpdatedAt,
      updatedAt: overrides.updatedAt ?? seededBaseUpdatedAt,
    };
    context.sourcePublishers.seedForTest(publisher);

    return publisher;
  }

  function createUseCase(
    context: PromoteTestContext,
  ): PromoteSourcePublisherToSourceGroupUseCase {
    return new PromoteSourcePublisherToSourceGroupUseCase(
      context.sourcePublishers,
      context.sourceGroups,
      context.categories,
      context.ids,
      context.clock,
    );
  }

  it("promotes an approved FACEBOOK GROUP publisher and saves a PAUSED SourceGroup", async () => {
    const context = createPromoteContext(["source-group-promoted-1"]);
    await seedCategory(context.categories);
    await seedApprovedGroupPublisher(context);

    const result = await createUseCase(context).execute({
      sourcePublisherId: "publisher-1",
      categoryId: "category-1",
      collectionPriority: 80,
    });

    expect(result.outcome).toBe("CREATED");
    expect(result.sourceGroup).toMatchObject({
      id: "source-group-promoted-1",
      platform: "FACEBOOK",
      externalGroupId: "synthetic-group-123",
      name: "Synthetic Knowledge Group",
      url: "https://www.facebook.com/groups/synthetic-group-123",
      categoryId: "category-1",
      status: "PAUSED",
      collectionPriority: 80,
    });
    expect(result.sourceGroup.entryRoutes).toHaveLength(1);
    expect(result.sourceGroup.entryRoutes[0]).toMatchObject({
      id: "direct-group-url",
      type: "DIRECT_GROUP_URL",
      isDefault: true,
    });

    const stored = await context.sourceGroups.findById("source-group-promoted-1");
    expect(stored).toEqual(result.sourceGroup);
  });

  it("uses the input url when provided and falls back to externalPublisherId when no displayName exists", async () => {
    const context = createPromoteContext(["source-group-promoted-2"]);
    await seedCategory(context.categories);
    await seedApprovedGroupPublisher(context, {
      id: "publisher-2",
      externalPublisherId: "synthetic-group-456",
      displayName: undefined,
      canonicalUrl: undefined,
    });

    const result = await createUseCase(context).execute({
      sourcePublisherId: "publisher-2",
      categoryId: "category-1",
      collectionPriority: 25,
      url: "https://facebook.test/groups/synthetic-group-456",
      notes: "Promoted after manual approval.",
    });

    expect(result.outcome).toBe("CREATED");
    expect(result.sourceGroup).toMatchObject({
      platform: "FACEBOOK",
      externalGroupId: "synthetic-group-456",
      name: "synthetic-group-456",
      url: "https://facebook.test/groups/synthetic-group-456",
      categoryId: "category-1",
      status: "PAUSED",
      collectionPriority: 25,
      notes: "Promoted after manual approval.",
    });
  });

  it("returns ALREADY_EXISTS when a SourceGroup already exists for the identity", async () => {
    const context = createPromoteContext(["source-group-1"]);
    await seedCategory(context.categories);
    await seedApprovedGroupPublisher(context);

    const seeded = await new CreateSourceGroupUseCase(
      context.sourceGroups,
      context.categories,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      externalGroupId: "synthetic-group-123",
      name: "Existing Source Group",
      url: "https://facebook.test/groups/synthetic-group-123",
      categoryId: "category-1",
      status: "ACTIVE",
      collectionPriority: 10,
    });

    const result = await createUseCase(context).execute({
      sourcePublisherId: "publisher-1",
      categoryId: "category-1",
      collectionPriority: 90,
    });

    expect(result.outcome).toBe("ALREADY_EXISTS");
    expect(result.sourceGroup).toEqual(seeded);
  });

  it("rejects PAGE publishers with NOT_GROUP", async () => {
    const context = createPromoteContext();
    await seedCategory(context.categories);
    await seedApprovedGroupPublisher(context, {
      id: "publisher-page",
      kind: "PAGE",
      externalPublisherId: "synthetic-page-1",
      canonicalUrl: "https://facebook.test/synthetic-page-1",
    });

    await expect(
      createUseCase(context).execute({
        sourcePublisherId: "publisher-page",
        categoryId: "category-1",
        collectionPriority: 50,
        url: "https://facebook.test/synthetic-page-1",
      }),
    ).rejects.toMatchObject({
      code: "SOURCE_PUBLISHER_NOT_PROMOTABLE",
      reason: "NOT_GROUP",
    });
  });

  it("rejects unapproved publishers with NOT_APPROVED", async () => {
    const context = createPromoteContext();
    await seedCategory(context.categories);
    await seedApprovedGroupPublisher(context, {
      id: "publisher-discovered",
      status: "DISCOVERED",
    });

    await expect(
      createUseCase(context).execute({
        sourcePublisherId: "publisher-discovered",
        categoryId: "category-1",
        collectionPriority: 50,
      }),
    ).rejects.toBeInstanceOf(SourcePublisherNotPromotableError);

    await expect(
      createUseCase(context).execute({
        sourcePublisherId: "publisher-discovered",
        categoryId: "category-1",
        collectionPriority: 50,
      }),
    ).rejects.toMatchObject({
      code: "SOURCE_PUBLISHER_NOT_PROMOTABLE",
      reason: "NOT_APPROVED",
    });
  });

  it("rejects BLOCKED and IGNORED publishers with NOT_APPROVED", async () => {
    const context = createPromoteContext();
    await seedCategory(context.categories);

    await seedApprovedGroupPublisher(context, {
      id: "publisher-blocked",
      status: "BLOCKED",
    });
    await expect(
      createUseCase(context).execute({
        sourcePublisherId: "publisher-blocked",
        categoryId: "category-1",
        collectionPriority: 50,
      }),
    ).rejects.toMatchObject({
      code: "SOURCE_PUBLISHER_NOT_PROMOTABLE",
      reason: "NOT_APPROVED",
    });

    await seedApprovedGroupPublisher(context, {
      id: "publisher-ignored",
      status: "IGNORED",
    });
    await expect(
      createUseCase(context).execute({
        sourcePublisherId: "publisher-ignored",
        categoryId: "category-1",
        collectionPriority: 50,
      }),
    ).rejects.toMatchObject({
      code: "SOURCE_PUBLISHER_NOT_PROMOTABLE",
      reason: "NOT_APPROVED",
    });
  });

  it("rejects a missing source publisher", async () => {
    const context = createPromoteContext();
    await seedCategory(context.categories);

    await expect(
      createUseCase(context).execute({
        sourcePublisherId: "missing",
        categoryId: "category-1",
        collectionPriority: 50,
      }),
    ).rejects.toBeInstanceOf(SourcePublisherNotFoundError);
  });

  it("rejects a missing category with CONTENT_CATEGORY_NOT_FOUND", async () => {
    const context = createPromoteContext();
    await seedApprovedGroupPublisher(context);

    await expect(
      createUseCase(context).execute({
        sourcePublisherId: "publisher-1",
        categoryId: "category-missing",
        collectionPriority: 50,
      }),
    ).rejects.toBeInstanceOf(ContentCategoryNotFoundError);
  });

  it("rejects promotion when no URL is available from input or publisher", async () => {
    const context = createPromoteContext();
    await seedCategory(context.categories);
    await seedApprovedGroupPublisher(context, {
      id: "publisher-no-url",
      canonicalUrl: undefined,
    });

    await expect(
      createUseCase(context).execute({
        sourcePublisherId: "publisher-no-url",
        categoryId: "category-1",
        collectionPriority: 50,
      }),
    ).rejects.toMatchObject({
      code: "SOURCE_PUBLISHER_NOT_PROMOTABLE",
      reason: "MISSING_URL",
    });

    const storedAfter = await context.sourceGroups.list({
      limit: 50,
      offset: 0,
    });
    expect(storedAfter.items).toEqual([]);
  });

  it("does not mutate SourcePublisher status or observation counts on promotion", async () => {
    const context = createPromoteContext(["source-group-promoted-3"]);
    await seedCategory(context.categories);
    const seeded = await seedApprovedGroupPublisher(context);

    await createUseCase(context).execute({
      sourcePublisherId: "publisher-1",
      categoryId: "category-1",
      collectionPriority: 70,
    });

    const after = await context.sourcePublishers.findById("publisher-1");
    expect(after).toEqual(seeded);
  });

  it("returns ALREADY_EXISTS on a race when a SourceGroup appears between check and save", async () => {
    const context = createPromoteContext(["source-group-1"]);
    await seedCategory(context.categories);
    await seedApprovedGroupPublisher(context);

    const racySourceGroups = new (class {
      private readonly inner = context.sourceGroups;
      private insertedAfterCheck = false;

      public async findByPlatformAndExternalGroupId(
        platform: ContentCategory["id"] & string,
        externalGroupId: string,
      ): Promise<Awaited<
        ReturnType<typeof context.sourceGroups.findByPlatformAndExternalGroupId>
      >> {
        const result = await this.inner.findByPlatformAndExternalGroupId(
          platform as never,
          externalGroupId,
        );

        if (!this.insertedAfterCheck) {
          this.insertedAfterCheck = true;
          await this.inner.save({
            id: "source-group-1",
            platform: "FACEBOOK",
            externalGroupId: "synthetic-group-123",
            name: "Existing Source Group",
            url: "https://facebook.test/groups/synthetic-group-123",
            categoryId: "category-1",
            status: "ACTIVE",
            collectionPriority: 10,
            entryRoutes: [],
            createdAt: seededBaseUpdatedAt,
            updatedAt: seededBaseUpdatedAt,
          });
        }

        return result;
      }

      public async save(): Promise<void> {
        throw new Error(
          "save should not be called when a race SourceGroup exists",
        );
      }
    })();

    const racyUseCase = new PromoteSourcePublisherToSourceGroupUseCase(
      context.sourcePublishers,
      racySourceGroups as unknown as typeof context.sourceGroups,
      context.categories,
      context.ids,
      context.clock,
    );

    const result = await racyUseCase.execute({
      sourcePublisherId: "publisher-1",
      categoryId: "category-1",
      collectionPriority: 50,
    });

    expect(result.outcome).toBe("ALREADY_EXISTS");
    expect(result.sourceGroup.id).toBe("source-group-1");
  });
});

interface PromoteTestContext {
  readonly sourcePublishers: InMemorySourcePublisherRepository;
  readonly sourceGroups: InMemorySourceGroupRepository;
  readonly categories: InMemoryContentCategoryRepository;
  readonly ids: FakeIdGenerator;
  readonly clock: FixedClock;
}

interface TestContext {
  readonly sourcePublishers: InMemorySourcePublisherRepository;
  readonly ids: FakeIdGenerator;
  readonly clock: FixedClock;
}

function createTestContext(ids: readonly string[] = []): TestContext {
  return {
    sourcePublishers: new InMemorySourcePublisherRepository(),
    ids: new FakeIdGenerator(ids),
    clock: new FixedClock(baseUpdatedAt),
  };
}

class FakeIdGenerator implements IdGenerator {
  private nextIdIndex = 0;

  public constructor(private readonly ids: readonly string[]) {}

  public async generateId(): Promise<string> {
    const id = this.ids[this.nextIdIndex];
    this.nextIdIndex += 1;

    return id ?? `generated-id-${this.nextIdIndex}`;
  }
}

class CountingSourcePublisherRepository implements SourcePublisherRepository {
  private readonly store = new Map<string, SourcePublisher>();
  public observeCount = 0;
  public updateStatusCount = 0;

  public async observeAtomically(
    input: AtomicSourcePublisherObservationInput,
  ): Promise<SourcePublisher> {
    this.observeCount += 1;
    const id = this.resolveExistingId(input);
    const existing = id === null ? null : (this.store.get(id) ?? null);
    const next: SourcePublisher = existing
      ? {
          ...existing,
          ...(input.displayName !== undefined && input.observedAt >= existing.lastObservedAt
            ? { displayName: input.displayName }
            : {}),
          ...(input.canonicalUrl !== undefined && input.observedAt >= existing.lastObservedAt
            ? { canonicalUrl: input.canonicalUrl }
            : {}),
          observationCount: existing.observationCount + 1,
          lastObservedAt:
            input.observedAt >= existing.lastObservedAt
              ? input.observedAt
              : existing.lastObservedAt,
          updatedAt: input.updatedAt,
        }
      : {
          id: input.candidateId,
          platform: input.platform,
          kind: input.kind,
          externalPublisherId: input.externalPublisherId,
          ...(input.displayName !== undefined
            ? { displayName: input.displayName }
            : {}),
          ...(input.canonicalUrl !== undefined
            ? { canonicalUrl: input.canonicalUrl }
            : {}),
          status: "DISCOVERED",
          firstObservedAt: input.observedAt,
          lastObservedAt: input.observedAt,
          observationCount: 1,
          createdAt: input.updatedAt,
          updatedAt: input.updatedAt,
        };
    this.store.set(next.id, next);

    return next;
  }

  public async updateStatus(
    input: SourcePublisherStatusPersistenceInput,
  ): Promise<SourcePublisher | null> {
    this.updateStatusCount += 1;
    const existing = this.store.get(input.sourcePublisherId);

    if (existing === undefined) {
      return null;
    }

    const next: SourcePublisher = {
      ...existing,
      status: input.status,
      updatedAt: input.updatedAt,
    };
    this.store.set(next.id, next);

    return next;
  }

  public async findById(id: string): Promise<SourcePublisher | null> {
    return this.store.get(id) ?? null;
  }

  public async findByIdentity(
    platform: SourcePublisher["platform"],
    kind: SourcePublisher["kind"],
    externalPublisherId: string,
  ): Promise<SourcePublisher | null> {
    for (const sourcePublisher of this.store.values()) {
      if (
        sourcePublisher.platform === platform &&
        sourcePublisher.kind === kind &&
        sourcePublisher.externalPublisherId === externalPublisherId
      ) {
        return sourcePublisher;
      }
    }
    return null;
  }

  public async list(
    query: SourcePublisherListQuery,
  ): Promise<SourcePublisherListResult> {
    const items = [...this.store.values()].filter(
      (sourcePublisher) =>
        (query.status === undefined || sourcePublisher.status === query.status) &&
        (query.kind === undefined || sourcePublisher.kind === query.kind) &&
        (query.platform === undefined || sourcePublisher.platform === query.platform),
    );

    return {
      items: items.slice(query.offset, query.offset + query.limit),
      total: items.length,
    };
  }

  private resolveExistingId(
    input: AtomicSourcePublisherObservationInput,
  ): string | null {
    for (const sourcePublisher of this.store.values()) {
      if (
        sourcePublisher.platform === input.platform &&
        sourcePublisher.kind === input.kind &&
        sourcePublisher.externalPublisherId === input.externalPublisherId
      ) {
        return sourcePublisher.id;
      }
    }
    return null;
  }
}

class CountingObservationSourcePublisherRepository
  implements SourcePublisherRepository
{
  public observeCount = 0;
  public updateStatusCount = 0;

  public async observeAtomically(
    _input: AtomicSourcePublisherObservationInput,
  ): Promise<SourcePublisher> {
    this.observeCount += 1;
    throw new Error("observeAtomically should not be called for invalid input");
  }

  public async updateStatus(
    _input: SourcePublisherStatusPersistenceInput,
  ): Promise<SourcePublisher | null> {
    this.updateStatusCount += 1;
    throw new Error("updateStatus should not be called for invalid input");
  }

  public async findById(): Promise<SourcePublisher | null> {
    return null;
  }

  public async findByIdentity(): Promise<SourcePublisher | null> {
    return null;
  }

  public async list(): Promise<SourcePublisherListResult> {
    return { items: [], total: 0 };
  }
}

class MalformedUpdateStatusSourcePublisherRepository
  implements SourcePublisherRepository
{
  private readonly store = new Map<string, SourcePublisher>();

  public async observeAtomically(
    input: AtomicSourcePublisherObservationInput,
  ): Promise<SourcePublisher> {
    const seeded: SourcePublisher = {
      id: input.candidateId,
      platform: input.platform,
      kind: input.kind,
      externalPublisherId: input.externalPublisherId,
      ...(input.displayName !== undefined
        ? { displayName: input.displayName }
        : {}),
      ...(input.canonicalUrl !== undefined
        ? { canonicalUrl: input.canonicalUrl }
        : {}),
      status: "DISCOVERED",
      firstObservedAt: input.observedAt,
      lastObservedAt: input.observedAt,
      observationCount: 1,
      createdAt: input.updatedAt,
      updatedAt: input.updatedAt,
    };
    this.store.set(seeded.id, seeded);
    return seeded;
  }

  public async updateStatus(
    input: SourcePublisherStatusPersistenceInput,
  ): Promise<SourcePublisher | null> {
    const existing = this.store.get(input.sourcePublisherId);
    if (existing === undefined) {
      return null;
    }
    return {
      ...existing,
      status: input.status,
      updatedAt: input.updatedAt,
      firstObservedAt: "2026-03-02T08:00:00.000Z",
      lastObservedAt: "2026-03-01T08:00:00.000Z",
    } as SourcePublisher;
  }

  public async findById(id: string): Promise<SourcePublisher | null> {
    return this.store.get(id) ?? null;
  }

  public async findByIdentity(): Promise<SourcePublisher | null> {
    return null;
  }

  public async list(): Promise<SourcePublisherListResult> {
    return { items: [], total: 0 };
  }
}

class FixedClock implements Clock {
  private current: Date;

  public constructor(isoDateTime: string) {
    this.current = new Date(isoDateTime);
  }

  public now(): Date {
    return new Date(this.current.getTime());
  }

  public setNow(isoDateTime: string): void {
    this.current = new Date(isoDateTime);
  }
}
