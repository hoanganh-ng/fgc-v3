import { describe, expect, it } from "vitest";
import {
  CollectionScheduleNotFoundError,
  CollectionScheduleSourceGroupNotActiveError,
  CollectionScheduleSourceGroupNotFoundError,
  CollectionScheduleSourceGroupPlatformUnsupportedError,
  CollectionScheduleValidationError,
  GetCollectionScheduleUseCase,
  ListCollectionSchedulesUseCase,
  SourceGroupLookupFailedError,
  UpsertCollectionScheduleUseCase,
} from "./index";
import type {
  Clock,
  SourceGroupLookupPort,
  SourceGroupLookupResult,
} from "./index";
import type {
  CollectionScheduleListQuery,
  CollectionScheduleListResult,
  CollectionScheduleRepository as CollectionScheduleRepositoryPort,
} from "./ports/collection-schedule-repository.port";
import { InMemoryCollectionScheduleRepository } from "./test-support/in-memory-collection-schedule-repository";
import type {
  CollectionSchedule,
  CollectionScheduleSourceGroupId,
} from "../domain";

const createdAt = "2026-06-17T10:00:00.000Z";
const updatedAt = "2026-06-17T11:00:00.000Z";
const sourceGroupId: CollectionScheduleSourceGroupId = "source-group-1";

describe("collector runtime collection schedule application use cases", () => {
  it("upserts a new schedule for an active Facebook source group", async () => {
    const context = createTestContext();

    const schedule = await new UpsertCollectionScheduleUseCase(
      context.schedules,
      context.sourceGroups,
      context.clock,
    ).execute({
      sourceGroupId,
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: "2026-06-17T10:30:00.000Z",
      parameters: { maxScrolls: 5, maxDurationMs: 45_000 },
    });

    expect(schedule).toEqual({
      sourceGroupId,
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: "2026-06-17T10:30:00.000Z",
      parameters: { maxScrolls: 5, maxDurationMs: 45_000 },
      createdAt,
      updatedAt: createdAt,
    });
    await expect(
      context.schedules.findBySourceGroupId(sourceGroupId),
    ).resolves.toEqual(schedule);
  });

  it("preserves persisted createdAt and bumps updatedAt on re-upsert", async () => {
    const context = createTestContext();
    await new UpsertCollectionScheduleUseCase(
      context.schedules,
      context.sourceGroups,
      context.clock,
    ).execute({
      sourceGroupId,
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: "2026-06-17T10:30:00.000Z",
      parameters: {},
    });
    context.clock.setNow(updatedAt);

    const updated = await new UpsertCollectionScheduleUseCase(
      context.schedules,
      context.sourceGroups,
      context.clock,
    ).execute({
      sourceGroupId,
      enabled: false,
      intervalMinutes: 60,
      nextRunAt: "2026-06-17T12:00:00.000Z",
      parameters: { maxScrolls: 1 },
    });

    expect(updated).toMatchObject({
      sourceGroupId,
      enabled: false,
      intervalMinutes: 60,
      nextRunAt: "2026-06-17T12:00:00.000Z",
      parameters: { maxScrolls: 1 },
      createdAt,
      updatedAt,
    });
  });

  it("allows disabled schedules for a paused Facebook source group", async () => {
    const context = createTestContext();
    context.sourceGroups.setSourceGroup({ status: "PAUSED" });

    const schedule = await new UpsertCollectionScheduleUseCase(
      context.schedules,
      context.sourceGroups,
      context.clock,
    ).execute({
      sourceGroupId,
      enabled: false,
      intervalMinutes: 30,
      nextRunAt: "2026-06-17T10:30:00.000Z",
      parameters: {},
    });

    expect(schedule.enabled).toBe(false);
  });

  it("allows disabled schedules for an archived Facebook source group", async () => {
    const context = createTestContext();
    context.sourceGroups.setSourceGroup({ status: "ARCHIVED" });

    const schedule = await new UpsertCollectionScheduleUseCase(
      context.schedules,
      context.sourceGroups,
      context.clock,
    ).execute({
      sourceGroupId,
      enabled: false,
      intervalMinutes: 30,
      nextRunAt: "2026-06-17T10:30:00.000Z",
      parameters: {},
    });

    expect(schedule.enabled).toBe(false);
  });

  it("rejects enabled schedules for a non-active Facebook source group", async () => {
    const context = createTestContext();
    context.sourceGroups.setSourceGroup({ status: "PAUSED" });

    await expect(
      new UpsertCollectionScheduleUseCase(
        context.schedules,
        context.sourceGroups,
        context.clock,
      ).execute({
        sourceGroupId,
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "2026-06-17T10:30:00.000Z",
        parameters: {},
      }),
    ).rejects.toThrow(CollectionScheduleSourceGroupNotActiveError);
  });

  it("rejects schedules for non-Facebook source groups", async () => {
    const context = createTestContext();
    context.sourceGroups.setSourceGroup({ platform: "YOUTUBE" });

    await expect(
      new UpsertCollectionScheduleUseCase(
        context.schedules,
        context.sourceGroups,
        context.clock,
      ).execute({
        sourceGroupId,
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "2026-06-17T10:30:00.000Z",
        parameters: {},
      }),
    ).rejects.toThrow(CollectionScheduleSourceGroupPlatformUnsupportedError);
  });

  it("rejects schedules when the source group is missing", async () => {
    const context = createTestContext();
    context.sourceGroups.setResult({
      ok: false,
      statusCode: 404,
      errorCode: "SOURCE_GROUP_NOT_FOUND",
      errorMessage: "Source group not found.",
    });

    await expect(
      new UpsertCollectionScheduleUseCase(
        context.schedules,
        context.sourceGroups,
        context.clock,
      ).execute({
        sourceGroupId: "missing-source-group" as CollectionScheduleSourceGroupId,
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "2026-06-17T10:30:00.000Z",
        parameters: {},
      }),
    ).rejects.toThrow(CollectionScheduleSourceGroupNotFoundError);
  });

  it("rejects schedules when the source group lookup throws", async () => {
    const context = createTestContext();
    context.sourceGroups.setThrow(new Error("network unreachable"));

    await expect(
      new UpsertCollectionScheduleUseCase(
        context.schedules,
        context.sourceGroups,
        context.clock,
      ).execute({
        sourceGroupId,
        enabled: true,
        intervalMinutes: 30,
        nextRunAt: "2026-06-17T10:30:00.000Z",
        parameters: {},
      }),
    ).rejects.toThrow(SourceGroupLookupFailedError);
  });

  it("rejects invalid schedule input", async () => {
    const context = createTestContext();

    await expect(
      new UpsertCollectionScheduleUseCase(
        context.schedules,
        context.sourceGroups,
        context.clock,
      ).execute({
        sourceGroupId: "",
        enabled: true,
        intervalMinutes: 0,
        nextRunAt: "not-a-date",
        parameters: { maxScrolls: -1 },
      }),
    ).rejects.toThrow(CollectionScheduleValidationError);
  });

  it("gets a schedule by sourceGroupId", async () => {
    const context = createTestContext();
    await seedSchedule(context);

    await expect(
      new GetCollectionScheduleUseCase(context.schedules).execute({
        sourceGroupId,
      }),
    ).resolves.toMatchObject({ sourceGroupId, enabled: true });
  });

  it("throws not-found when getting an unknown schedule", async () => {
    const context = createTestContext();

    await expect(
      new GetCollectionScheduleUseCase(context.schedules).execute({
        sourceGroupId: "missing" as CollectionScheduleSourceGroupId,
      }),
    ).rejects.toThrow(CollectionScheduleNotFoundError);
  });

  it("lists schedules with empty repo", async () => {
    const context = createTestContext();

    await expect(
      new ListCollectionSchedulesUseCase(context.schedules).execute(),
    ).resolves.toEqual({
      items: [],
      page: { limit: 50, offset: 0, total: 0 },
    });
  });

  it("lists schedules deterministically by nextRunAt then sourceGroupId", async () => {
    const context = createTestContext();
    await seedSchedule(context, {
      sourceGroupId: "source-group-b" as CollectionScheduleSourceGroupId,
      nextRunAt: "2026-06-17T12:00:00.000Z",
    });
    await seedSchedule(context, {
      sourceGroupId: "source-group-a" as CollectionScheduleSourceGroupId,
      nextRunAt: "2026-06-17T11:00:00.000Z",
    });
    await seedSchedule(context, {
      sourceGroupId: "source-group-c" as CollectionScheduleSourceGroupId,
      nextRunAt: "2026-06-17T11:00:00.000Z",
    });

    const result = await new ListCollectionSchedulesUseCase(
      context.schedules,
    ).execute();

    expect(result.items.map((item) => item.sourceGroupId)).toEqual([
      "source-group-a",
      "source-group-c",
      "source-group-b",
    ]);
    expect(result.page.total).toBe(3);
  });

  it("returns the full total regardless of pagination", async () => {
    const context = createTestContext();
    for (const id of [
      "source-group-1",
      "source-group-2",
      "source-group-3",
      "source-group-4",
      "source-group-5",
    ]) {
      await seedSchedule(context, {
        sourceGroupId: id as CollectionScheduleSourceGroupId,
      });
    }

    const firstPage = await new ListCollectionSchedulesUseCase(
      context.schedules,
    ).execute({ limit: 2, offset: 0 });
    const lastPage = await new ListCollectionSchedulesUseCase(
      context.schedules,
    ).execute({ limit: 2, offset: 4 });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.page.total).toBe(5);
    expect(lastPage.items).toHaveLength(1);
    expect(lastPage.page.total).toBe(5);
  });

  it("rejects invalid list pagination", async () => {
    const context = createTestContext();

    await expect(
      new ListCollectionSchedulesUseCase(context.schedules).execute({
        limit: 0,
        offset: 0,
      }),
    ).rejects.toThrow(CollectionScheduleValidationError);
    await expect(
      new ListCollectionSchedulesUseCase(context.schedules).execute({
        limit: 10,
        offset: -1,
      }),
    ).rejects.toThrow(CollectionScheduleValidationError);
  });

  it("delegates timestamp ownership to the use case and stores the aggregate unchanged", async () => {
    const recorder = new RecordingCollectionScheduleRepository();
    const sourceGroups = new FakeSourceGroupLookupPort();
    const clock = new FixedClock();

    const useCase = new UpsertCollectionScheduleUseCase(
      recorder,
      sourceGroups,
      clock,
    );

    const initial = await useCase.execute({
      sourceGroupId,
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: "2026-06-17T10:30:00.000Z",
      parameters: { maxScrolls: 5 },
    });

    expect(recorder.saved).toHaveLength(1);
    expect(recorder.saved[0]).toEqual({
      sourceGroupId,
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: "2026-06-17T10:30:00.000Z",
      parameters: { maxScrolls: 5 },
      createdAt,
      updatedAt: createdAt,
    });
    expect(recorder.saved[0]).toEqual(initial);

    clock.setNow(updatedAt);

    const updated = await useCase.execute({
      sourceGroupId,
      enabled: false,
      intervalMinutes: 60,
      nextRunAt: "2026-06-17T12:00:00.000Z",
      parameters: { maxScrolls: 1 },
    });

    expect(recorder.saved).toHaveLength(2);
    expect(recorder.saved[1]).toEqual({
      sourceGroupId,
      enabled: false,
      intervalMinutes: 60,
      nextRunAt: "2026-06-17T12:00:00.000Z",
      parameters: { maxScrolls: 1 },
      createdAt,
      updatedAt,
    });
    expect(recorder.saved[1]).toEqual(updated);
    expect(recorder.saved[1]?.createdAt).toBe(createdAt);
    expect(recorder.saved[1]?.updatedAt).toBe(updatedAt);
  });
});

interface TestContext {
  readonly schedules: InMemoryCollectionScheduleRepository;
  readonly sourceGroups: FakeSourceGroupLookupPort;
  readonly clock: FixedClock;
}

function createTestContext(): TestContext {
  return {
    schedules: new InMemoryCollectionScheduleRepository(),
    sourceGroups: new FakeSourceGroupLookupPort(),
    clock: new FixedClock(),
  };
}

async function seedSchedule(
  context: TestContext,
  options: Partial<CollectionSchedule> = {},
): Promise<CollectionSchedule> {
  const schedule = createSchedule(options);

  await context.schedules.save(schedule);

  return schedule;
}

function createSchedule(
  options: Partial<CollectionSchedule> = {},
): CollectionSchedule {
  return {
    sourceGroupId: options.sourceGroupId ?? sourceGroupId,
    enabled: options.enabled ?? true,
    intervalMinutes: options.intervalMinutes ?? 30,
    nextRunAt: options.nextRunAt ?? "2026-06-17T10:30:00.000Z",
    parameters: options.parameters ?? {},
    createdAt: options.createdAt ?? createdAt,
    updatedAt: options.updatedAt ?? createdAt,
  };
}

class FixedClock implements Clock {
  private current = new Date(createdAt);

  public now(): Date {
    return this.current;
  }

  public setNow(value: string): void {
    this.current = new Date(value);
  }
}

class RecordingCollectionScheduleRepository
  implements CollectionScheduleRepositoryPort
{
  public readonly saved: CollectionSchedule[] = [];
  private readonly store = new Map<
    CollectionScheduleSourceGroupId,
    CollectionSchedule
  >();

  public async save(schedule: CollectionSchedule): Promise<void> {
    this.saved.push({ ...schedule });
    this.store.set(schedule.sourceGroupId, { ...schedule });
  }

  public async findBySourceGroupId(
    sourceGroupId: CollectionScheduleSourceGroupId,
  ): Promise<CollectionSchedule | null> {
    return this.store.get(sourceGroupId) ?? null;
  }

  public async list(
    query: CollectionScheduleListQuery,
  ): Promise<CollectionScheduleListResult> {
    return {
      items: [...this.store.values()],
      total: this.store.size,
    };
  }
}

class FakeSourceGroupLookupPort implements SourceGroupLookupPort {
  public readonly calls: string[] = [];
  private result: SourceGroupLookupResult = {
    ok: true,
    statusCode: 200,
    sourceGroup: {
      id: sourceGroupId,
      platform: "FACEBOOK",
      status: "ACTIVE",
      url: "https://www.facebook.com/groups/source-group-1",
      categoryId: "category-1",
    },
  };
  private throwOverride: Error | undefined;

  public async getSourceGroup(
    requestedSourceGroupId: string,
  ): Promise<SourceGroupLookupResult> {
    this.calls.push(requestedSourceGroupId);

    if (this.throwOverride !== undefined) {
      throw this.throwOverride;
    }

    if (this.result.ok) {
      return {
        ...this.result,
        sourceGroup: {
          ...this.result.sourceGroup,
          id: requestedSourceGroupId,
        },
      };
    }

    return this.result;
  }

  public setResult(result: SourceGroupLookupResult): void {
    this.throwOverride = undefined;
    this.result = result;
  }

  public setThrow(error: Error): void {
    this.throwOverride = error;
  }

  public setSourceGroup(
    options: Partial<{
      readonly id: string;
      readonly platform: string;
      readonly status: string;
      readonly url: string;
      readonly categoryId: string;
    }>,
  ): void {
    this.throwOverride = undefined;
    this.result = {
      ok: true,
      statusCode: 200,
      sourceGroup: {
        id: options.id ?? sourceGroupId,
        platform: options.platform ?? "FACEBOOK",
        status: options.status ?? "ACTIVE",
        url: options.url ?? "https://www.facebook.com/groups/source-group-1",
        categoryId: options.categoryId ?? "category-1",
      },
    };
  }
}
