import { describe, expect, it } from "vitest";
import {
  CancelAccountExerciseRunUseCase,
  CancelCollectionRunUseCase,
  AttachAccountExerciseRunLeaseUseCase,
  ClaimNextAccountExerciseRunUseCase,
  ClaimNextCollectionRunUseCase,
  ClaimNextProfileHomeFeedCollectionRunUseCase,
  DispatchNextDueCollectionScheduleUseCase,
  GetAccountExerciseRunUseCase,
  GetCollectionRunUseCase,
  GetCollectionScheduleUseCase,
  GetProfileHomeFeedCollectionRunUseCase,
  ListAccountExerciseRunsUseCase,
  ListCollectionRunsUseCase,
  ListCollectionSchedulesUseCase,
  ListProfileHomeFeedCollectionRunsUseCase,
  MarkAccountExerciseRunFailedUseCase,
  MarkAccountExerciseRunRunningUseCase,
  MarkAccountExerciseRunSucceededUseCase,
  MarkCollectionRunFailedUseCase,
  MarkCollectionRunRunningUseCase,
  MarkCollectionRunSucceededUseCase,
  MarkProfileHomeFeedCollectionRunFailedUseCase,
  MarkProfileHomeFeedCollectionRunSucceededUseCase,
  RequestCollectionRunUseCase,
  RequestAccountExerciseRunUseCase,
  RequestProfileHomeFeedCollectionRunUseCase,
  CancelProfileHomeFeedCollectionRunUseCase,
  UpsertCollectionScheduleUseCase,
} from "../../collector-runtime/application";
import type {
  Clock,
  IdGenerator,
  SourceGroupLookupPort,
  SourceGroupLookupResult,
  ProfileReferencePort,
  ProfileReferenceResult,
} from "../../collector-runtime/application";
import { InMemoryCollectionRunRepository } from "../../collector-runtime/application/test-support/in-memory-collection-run-repository";
import { InMemoryAccountExerciseRunRepository } from "../../collector-runtime/application/test-support/in-memory-account-exercise-run-repository";
import { InMemoryCollectionScheduleRepository } from "../../collector-runtime/application/test-support/in-memory-collection-schedule-repository";
import { InMemoryDispatchNextDueCollectionScheduleRepository } from "../../collector-runtime/application/test-support/in-memory-dispatch-next-due-collection-schedule.repository";
import { InMemoryProfileHomeFeedCollectionRunRepository } from "../../collector-runtime/application/test-support/in-memory-profile-home-feed-collection-run-repository";
import { InMemoryProfileSourceAccessCheckRunRepository } from "../../collector-runtime/application/test-support/in-memory-profile-source-access-check-run-repository";
import { createCollectorRuntime } from "./collector-runtime.container";

describe("collector runtime composition container", () => {
  it("creates all expected services from supplied dependencies", async () => {
    let closed = false;
    const services = createCollectorRuntime({
      accountExerciseRuns: new InMemoryAccountExerciseRunRepository(),
      collectionRuns: new InMemoryCollectionRunRepository(),
      collectionSchedules: new InMemoryCollectionScheduleRepository(),
      dispatchNextDueCollectionSchedules:
        new InMemoryDispatchNextDueCollectionScheduleRepository(),
      homeFeedRuns: new InMemoryProfileHomeFeedCollectionRunRepository(),
      checkRuns: new InMemoryProfileSourceAccessCheckRunRepository(),
      sourceGroups: new FakeSourceGroupLookupPort(),
      profiles: new FakeProfileReferencePort(),
      clock: new FixedClock(),
      idGenerator: new FakeIdGenerator(),
      close: async () => {
        closed = true;
      },
    });

    expect(services.requestAccountExerciseRun).toBeInstanceOf(
      RequestAccountExerciseRunUseCase,
    );
    expect(services.getAccountExerciseRun).toBeInstanceOf(
      GetAccountExerciseRunUseCase,
    );
    expect(services.listAccountExerciseRuns).toBeInstanceOf(
      ListAccountExerciseRunsUseCase,
    );
    expect(services.markAccountExerciseRunRunning).toBeInstanceOf(
      MarkAccountExerciseRunRunningUseCase,
    );
    expect(services.markAccountExerciseRunSucceeded).toBeInstanceOf(
      MarkAccountExerciseRunSucceededUseCase,
    );
    expect(services.markAccountExerciseRunFailed).toBeInstanceOf(
      MarkAccountExerciseRunFailedUseCase,
    );
    expect(services.attachAccountExerciseRunLease).toBeInstanceOf(
      AttachAccountExerciseRunLeaseUseCase,
    );
    expect(services.cancelAccountExerciseRun).toBeInstanceOf(
      CancelAccountExerciseRunUseCase,
    );
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
    expect(services.claimNextAccountExerciseRun).toBeInstanceOf(
      ClaimNextAccountExerciseRunUseCase,
    );
    expect(services.claimNextCollectionRun).toBeInstanceOf(
      ClaimNextCollectionRunUseCase,
    );
    expect(services.upsertCollectionSchedule).toBeInstanceOf(
      UpsertCollectionScheduleUseCase,
    );
    expect(services.getCollectionSchedule).toBeInstanceOf(
      GetCollectionScheduleUseCase,
    );
    expect(services.listCollectionSchedules).toBeInstanceOf(
      ListCollectionSchedulesUseCase,
    );
    expect(services.dispatchNextDueCollectionSchedule).toBeInstanceOf(
      DispatchNextDueCollectionScheduleUseCase,
    );
    expect(services.requestProfileHomeFeedCollectionRun).toBeInstanceOf(
      RequestProfileHomeFeedCollectionRunUseCase,
    );
    expect(services.getProfileHomeFeedCollectionRun).toBeInstanceOf(
      GetProfileHomeFeedCollectionRunUseCase,
    );
    expect(services.listProfileHomeFeedCollectionRuns).toBeInstanceOf(
      ListProfileHomeFeedCollectionRunsUseCase,
    );
    expect(
      services.markProfileHomeFeedCollectionRunSucceeded,
    ).toBeInstanceOf(MarkProfileHomeFeedCollectionRunSucceededUseCase);
    expect(services.markProfileHomeFeedCollectionRunFailed).toBeInstanceOf(
      MarkProfileHomeFeedCollectionRunFailedUseCase,
    );
    expect(services.cancelProfileHomeFeedCollectionRun).toBeInstanceOf(
      CancelProfileHomeFeedCollectionRunUseCase,
    );
    expect(services.claimNextProfileHomeFeedCollectionRun).toBeInstanceOf(
      ClaimNextProfileHomeFeedCollectionRunUseCase,
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
        categoryId: "category-1",
      },
    };
  }
}

class FakeProfileReferencePort implements ProfileReferencePort {
  public async getProfileAccountStage(): Promise<ProfileReferenceResult> {
    return {
      ok: true,
      profileId: "profile-1",
      accountStage: "WARMING",
    };
  }
}
