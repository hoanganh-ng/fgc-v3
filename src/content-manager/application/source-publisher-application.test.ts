import { describe, expect, it } from "vitest";
import {
  ContentValidationError,
  GetSourcePublisherUseCase,
  ListSourcePublishersUseCase,
  MAX_SOURCE_PUBLISHER_LIST_LIMIT,
  ObserveSourcePublisherUseCase,
  SourcePublisherNotFoundError,
  UpdateSourcePublisherStatusUseCase,
} from "./index";
import type { Clock, IdGenerator } from "./index";
import { InMemorySourcePublisherRepository } from "./test-support/in-memory-repositories";
import type { SourcePublisher } from "../domain";

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
    const context = createTestContext(["publisher-1"]);

    await expect(
      new ObserveSourcePublisherUseCase(
        context.sourcePublishers,
        context.ids,
        context.clock,
      ).execute({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "facebook-group-1",
        observedAt: "not-a-timestamp",
      }),
    ).rejects.toThrow();
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
    const savingRepository = new CountingSourcePublisherRepository();

    await new ObserveSourcePublisherUseCase(
      savingRepository,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: baseObservedAt,
    });

    await new UpdateSourcePublisherStatusUseCase(
      savingRepository,
      context.clock,
    ).execute({
      sourcePublisherId: "publisher-1",
      status: "APPROVED",
    });

    const updatedAtBefore = (await savingRepository.findById("publisher-1"))!
      .updatedAt;
    const saveCountBefore = savingRepository.saveCallCount;
    context.clock.setNow(laterUpdatedAt);

    const updated = await new UpdateSourcePublisherStatusUseCase(
      savingRepository,
      context.clock,
    ).execute({
      sourcePublisherId: "publisher-1",
      status: "APPROVED",
    });

    expect(updated.updatedAt).toBe(updatedAtBefore);
    expect(updated).toEqual(
      await savingRepository.findById("publisher-1"),
    );
    expect(savingRepository.saveCallCount).toBe(saveCountBefore);
  });

  it("saves exactly once on a real status change", async () => {
    const context = createTestContext(["publisher-1"]);
    const savingRepository = new CountingSourcePublisherRepository();

    await new ObserveSourcePublisherUseCase(
      savingRepository,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      observedAt: baseObservedAt,
    });

    const saveCountAfterObserve = savingRepository.saveCallCount;
    context.clock.setNow(laterUpdatedAt);

    await new UpdateSourcePublisherStatusUseCase(
      savingRepository,
      context.clock,
    ).execute({
      sourcePublisherId: "publisher-1",
      status: "APPROVED",
    });

    expect(savingRepository.saveCallCount).toBe(saveCountAfterObserve + 1);
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

  it("lists with status, kind, and platform filters plus pagination ordered by lastObservedAt desc, id asc", async () => {
    const context = createTestContext([
      "publisher-a",
      "publisher-b",
      "publisher-c",
      "publisher-d",
    ]);

    await context.sourcePublishers.save({
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
    await context.sourcePublishers.save({
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
    await context.sourcePublishers.save({
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
    await context.sourcePublishers.save({
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

  it("does not touch the repository when findByIdentity returns malformed data", async () => {
    const stubRepository = new MalformedIdentitySourcePublisherRepository();
    const context = createTestContext();

    await expect(
      new ObserveSourcePublisherUseCase(
        stubRepository,
        context.ids,
        context.clock,
      ).execute({
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "facebook-group-1",
        observedAt: baseObservedAt,
      }),
    ).rejects.toThrow(ContentValidationError);

    expect(stubRepository.saveCallCount).toBe(0);
  });

  it("validates repository outputs through the runtime schema", async () => {
    const context = createTestContext();

    await context.sourcePublishers.save({
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
});

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

class CountingSourcePublisherRepository {
  private readonly store = new Map<
    string,
    SourcePublisher
  >();
  public saveCallCount = 0;

  public async save(sourcePublisher: SourcePublisher): Promise<void> {
    this.saveCallCount += 1;
    this.store.set(sourcePublisher.id, sourcePublisher);
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

  public async list(): Promise<{
    items: readonly SourcePublisher[];
    total: number;
  }> {
    return { items: [...this.store.values()], total: this.store.size };
  }
}

class MalformedIdentitySourcePublisherRepository {
  public saveCallCount = 0;

  public async save(): Promise<void> {
    this.saveCallCount += 1;
  }

  public async findById(): Promise<SourcePublisher | null> {
    return null;
  }

  public async findByIdentity(): Promise<SourcePublisher | null> {
    return {
      id: "publisher-malformed",
      platform: "FACEBOOK",
      kind: "GROUP",
      externalPublisherId: "facebook-group-1",
      status: "DISCOVERED",
      firstObservedAt: baseObservedAt,
      lastObservedAt: olderObservedAt,
      observationCount: 1,
      createdAt: baseUpdatedAt,
      updatedAt: baseUpdatedAt,
    } as unknown as SourcePublisher;
  }

  public async list(): Promise<{
    items: readonly SourcePublisher[];
  }> {
    return { items: [] };
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
