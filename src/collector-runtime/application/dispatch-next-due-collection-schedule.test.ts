import { describe, expect, it } from "vitest";
import {
  CollectionRunValidationError,
  CollectionScheduleValidationError,
  DispatchNextDueCollectionScheduleUseCase,
} from "./index";
import type {
  Clock,
  IdGenerator,
  DispatchNextDueCollectionScheduleRepositoryPort,
  DispatchNextDueCollectionScheduleResult,
} from "./index";
import type {
  CollectionRun,
  CollectionSchedule,
  CollectionScheduleSourceGroupId,
} from "../domain";
import { InMemoryDispatchNextDueCollectionScheduleRepository } from "./test-support/in-memory-dispatch-next-due-collection-schedule.repository";

const dispatchAt = "2026-06-17T10:35:00.000Z";
const collectionRunId = "scheduled-run-1";
const sourceGroupId: CollectionScheduleSourceGroupId = "source-group-1";

describe("DispatchNextDueCollectionScheduleUseCase", () => {
  it("dispatches a due schedule and returns the advanced schedule plus the run", async () => {
    const dispatcher = new InMemoryDispatchNextDueCollectionScheduleRepository();
    dispatcher.seedSchedule(createSchedule());

    const useCase = new DispatchNextDueCollectionScheduleUseCase(
      dispatcher,
      new FixedClock(dispatchAt),
      new FixedIdGenerator(collectionRunId),
    );

    const result = await useCase.execute();

    expect(result).not.toBeNull();
    expect(result?.schedule).toMatchObject({
      sourceGroupId,
      enabled: true,
      intervalMinutes: 30,
      nextRunAt: "2026-06-17T11:00:00.000Z",
      updatedAt: dispatchAt,
    });
    expect(result?.collectionRun).toEqual({
      id: collectionRunId,
      sourceGroupId,
      status: "QUEUED",
      triggerType: "SCHEDULED",
      parameters: { maxScrolls: 5 },
      requestedAt: "2026-06-17T10:00:00.000Z",
      createdAt: dispatchAt,
      updatedAt: dispatchAt,
    });
    expect(result?.schedule.createdAt).toBe("2026-06-17T09:00:00.000Z");
    expect(dispatcher.getInvocations()).toEqual([
      { dispatchAt, collectionRunId },
    ]);
  });

  it("returns null when no schedule is due", async () => {
    const dispatcher = new InMemoryDispatchNextDueCollectionScheduleRepository();
    const useCase = new DispatchNextDueCollectionScheduleUseCase(
      dispatcher,
      new FixedClock(dispatchAt),
      new FixedIdGenerator(collectionRunId),
    );

    await expect(useCase.execute()).resolves.toBeNull();
    expect(dispatcher.getInvocations()).toHaveLength(1);
  });

  it("returns null for a disabled schedule with past nextRunAt", async () => {
    const dispatcher = new InMemoryDispatchNextDueCollectionScheduleRepository();
    dispatcher.seedSchedule(createSchedule({ enabled: false }));
    const useCase = new DispatchNextDueCollectionScheduleUseCase(
      dispatcher,
      new FixedClock(dispatchAt),
      new FixedIdGenerator(collectionRunId),
    );

    await expect(useCase.execute()).resolves.toBeNull();
  });

  it("returns null for a schedule whose nextRunAt is in the future", async () => {
    const dispatcher = new InMemoryDispatchNextDueCollectionScheduleRepository();
    dispatcher.seedSchedule(
      createSchedule({ nextRunAt: "2026-06-17T11:00:00.000Z" }),
    );
    const useCase = new DispatchNextDueCollectionScheduleUseCase(
      dispatcher,
      new FixedClock("2026-06-17T10:35:00.000Z"),
      new FixedIdGenerator(collectionRunId),
    );

    await expect(useCase.execute()).resolves.toBeNull();
  });

  it("uses the exact clock.now() value as dispatchAt", async () => {
    const dispatcher = new InMemoryDispatchNextDueCollectionScheduleRepository();
    dispatcher.seedSchedule(createSchedule());
    const useCase = new DispatchNextDueCollectionScheduleUseCase(
      dispatcher,
      new FixedClock("2026-06-17T10:35:30.250Z"),
      new FixedIdGenerator(collectionRunId),
    );

    await useCase.execute();

    expect(dispatcher.getInvocations()[0]?.dispatchAt).toBe(
      "2026-06-17T10:35:30.250Z",
    );
  });

  it("throws CollectionScheduleValidationError when the dispatcher returns an invalid schedule", async () => {
    const dispatcher = new InMemoryDispatchNextDueCollectionScheduleRepository();
    dispatcher.seedSchedule(createSchedule());
    const useCase = new DispatchNextDueCollectionScheduleUseCase(
      new InvalidScheduleDispatcher(),
      new FixedClock(dispatchAt),
      new FixedIdGenerator(collectionRunId),
    );

    await expect(useCase.execute()).rejects.toThrow(
      CollectionScheduleValidationError,
    );
  });

  it("throws CollectionRunValidationError when the dispatcher returns an invalid run", async () => {
    const dispatcher = new InMemoryDispatchNextDueCollectionScheduleRepository();
    dispatcher.seedSchedule(createSchedule());
    const useCase = new DispatchNextDueCollectionScheduleUseCase(
      new InvalidRunDispatcher(),
      new FixedClock(dispatchAt),
      new FixedIdGenerator(collectionRunId),
    );

    await expect(useCase.execute()).rejects.toThrow(
      CollectionRunValidationError,
    );
  });
});

function createSchedule(
  overrides: Partial<CollectionSchedule> = {},
): CollectionSchedule {
  return {
    sourceGroupId,
    enabled: true,
    intervalMinutes: 30,
    nextRunAt: "2026-06-17T10:00:00.000Z",
    parameters: { maxScrolls: 5 },
    createdAt: "2026-06-17T09:00:00.000Z",
    updatedAt: "2026-06-17T09:00:00.000Z",
    ...overrides,
  };
}

class FixedClock implements Clock {
  public constructor(private readonly current: Date | string) {}

  public now(): Date {
    return this.current instanceof Date
      ? this.current
      : new Date(this.current);
  }
}

class FixedIdGenerator implements IdGenerator {
  public constructor(private readonly id: string) {}

  public async generateId(): Promise<string> {
    return this.id;
  }
}

class InvalidScheduleDispatcher
  implements DispatchNextDueCollectionScheduleRepositoryPort
{
  public async dispatchNextDue(): Promise<DispatchNextDueCollectionScheduleResult> {
    return {
      schedule: {
        sourceGroupId,
        enabled: true,
        intervalMinutes: 0,
        nextRunAt: "2026-06-17T11:00:00.000Z",
        parameters: {},
        createdAt: "2026-06-17T09:00:00.000Z",
        updatedAt: "2026-06-17T09:00:00.000Z",
      },
      collectionRun: {
        id: collectionRunId,
        sourceGroupId,
        status: "QUEUED",
        triggerType: "SCHEDULED",
        parameters: {},
        requestedAt: "2026-06-17T10:00:00.000Z",
        createdAt: dispatchAt,
        updatedAt: dispatchAt,
      },
    };
  }
}

class InvalidRunDispatcher
  implements DispatchNextDueCollectionScheduleRepositoryPort
{
  public async dispatchNextDue(): Promise<DispatchNextDueCollectionScheduleResult> {
    const run: CollectionRun = {
      id: collectionRunId,
      sourceGroupId,
      status: "QUEUED",
      triggerType: "MANUAL_API",
      parameters: {},
      requestedAt: "2026-06-17T10:00:00.000Z",
      createdAt: dispatchAt,
      updatedAt: dispatchAt,
    };

    return {
      schedule: createSchedule(),
      collectionRun: { ...run, triggerType: "BOGUS" as CollectionRun["triggerType"] },
    };
  }
}