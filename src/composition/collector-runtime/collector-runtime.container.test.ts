import { describe, expect, it } from "vitest";
import {
  CancelCollectionRunUseCase,
  GetCollectionRunUseCase,
  ListCollectionRunsUseCase,
  MarkCollectionRunFailedUseCase,
  MarkCollectionRunRunningUseCase,
  MarkCollectionRunSucceededUseCase,
  RequestCollectionRunUseCase,
} from "../../collector-runtime/application";
import type {
  Clock,
  IdGenerator,
  SourceGroupLookupPort,
  SourceGroupLookupResult,
} from "../../collector-runtime/application";
import { InMemoryCollectionRunRepository } from "../../collector-runtime/application/test-support/in-memory-collection-run-repository";
import { createCollectorRuntime } from "./collector-runtime.container";

describe("collector runtime composition container", () => {
  it("creates all expected services from supplied dependencies", async () => {
    let closed = false;
    const services = createCollectorRuntime({
      collectionRuns: new InMemoryCollectionRunRepository(),
      sourceGroups: new FakeSourceGroupLookupPort(),
      clock: new FixedClock(),
      idGenerator: new FakeIdGenerator(),
      close: async () => {
        closed = true;
      },
    });

    expect(services.requestCollectionRun).toBeInstanceOf(
      RequestCollectionRunUseCase,
    );
    expect(services.getCollectionRun).toBeInstanceOf(GetCollectionRunUseCase);
    expect(services.listCollectionRuns).toBeInstanceOf(
      ListCollectionRunsUseCase,
    );
    expect(services.markCollectionRunRunning).toBeInstanceOf(
      MarkCollectionRunRunningUseCase,
    );
    expect(services.markCollectionRunSucceeded).toBeInstanceOf(
      MarkCollectionRunSucceededUseCase,
    );
    expect(services.markCollectionRunFailed).toBeInstanceOf(
      MarkCollectionRunFailedUseCase,
    );
    expect(services.cancelCollectionRun).toBeInstanceOf(
      CancelCollectionRunUseCase,
    );

    await services.close();

    expect(closed).toBe(true);
  });
});

class FixedClock implements Clock {
  public now(): Date {
    return new Date("2026-01-01T00:00:00.000Z");
  }
}

class FakeIdGenerator implements IdGenerator {
  public async generateId(): Promise<string> {
    return "collection-run-1";
  }
}

class FakeSourceGroupLookupPort implements SourceGroupLookupPort {
  public async getSourceGroup(): Promise<SourceGroupLookupResult> {
    return {
      ok: true,
      sourceGroup: {
        id: "source-group-1",
        platform: "FACEBOOK",
        status: "ACTIVE",
        url: "https://www.facebook.com/groups/source-group-1",
      },
    };
  }
}
