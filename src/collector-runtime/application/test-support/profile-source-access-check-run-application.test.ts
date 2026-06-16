import { describe, expect, it } from "vitest";
import {
  CancelProfileSourceAccessCheckRunUseCase,
  GetProfileSourceAccessCheckRunUseCase,
  ListProfileSourceAccessCheckRunsUseCase,
  MarkProfileSourceAccessCheckRunFailedUseCase,
  MarkProfileSourceAccessCheckRunRunningUseCase,
  MarkProfileSourceAccessCheckRunSucceededUseCase,
  RequestProfileSourceAccessCheckRunUseCase,
  ProfileNotFoundError,
  ProfileReferenceLookupFailedError,
  ProfileSourceAccessCheckRunConflictError,
  ProfileSourceAccessCheckRunSourceGroupNotActiveError,
  ProfileSourceAccessCheckRunSourceGroupNotFoundError,
  ProfileSourceAccessCheckRunSourceGroupPlatformUnsupportedError,
  SourceGroupLookupFailedError,
} from "../index";
import type {
  Clock,
  IdGenerator,
  SourceGroupLookupPort,
  SourceGroupLookupResult,
  ProfileReferencePort,
  ProfileReferenceResult,
} from "../index";
import { InMemoryProfileSourceAccessCheckRunRepository } from "./in-memory-profile-source-access-check-run-repository";

const createdAt = "2026-05-01T10:00:00.000Z";
const updatedAt = "2026-05-01T10:05:00.000Z";

describe("collector runtime profile-source access check run application use cases", () => {
  it("requests a check run", async () => {
    const context = createTestContext(["check-run-1"]);

    const run = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    expect(run).toEqual({
      id: "check-run-1",
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      triggerType: "MANUAL",
      status: "QUEUED",
      accountStageAtRequest: "WARMING",
      target: {
        platform: "FACEBOOK",
        routeType: "DIRECT_GROUP_URL",
        url: "https://www.facebook.com/groups/source-group-1",
      },
      requestedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it("prevents requesting multiple active check runs for the same profile and source group", async () => {
    const context = createTestContext(["check-run-1", "check-run-2"]);

    await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    await expect(
      new RequestProfileSourceAccessCheckRunUseCase(
        context.checkRuns,
        context.profiles,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    ).rejects.toThrow(ProfileSourceAccessCheckRunConflictError);
  });

  it("rejects check run request if profile is not found", async () => {
    const context = createTestContext(["check-run-1"]);
    context.profiles.result = {
      ok: false,
      errorCode: "PROFILE_NOT_FOUND",
      errorMessage: "Not found",
    };

    await expect(
      new RequestProfileSourceAccessCheckRunUseCase(
        context.checkRuns,
        context.profiles,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it("rejects check run request if profile ID mismatches", async () => {
    const context = createTestContext(["check-run-1"]);
    context.profiles.result = {
      ok: true,
      profileId: "different-profile",
      accountStage: "WARMING",
    };

    await expect(
      new RequestProfileSourceAccessCheckRunUseCase(
        context.checkRuns,
        context.profiles,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    ).rejects.toThrow(ProfileReferenceLookupFailedError);
  });

  it("rejects check run request if source group ID mismatches", async () => {
    const context = createTestContext(["check-run-1"]);
    context.sourceGroups.result = {
      ok: true,
      statusCode: 200,
      sourceGroup: {
        id: "different-source-group",
        platform: "FACEBOOK",
        status: "ACTIVE",
        url: "https://www.facebook.com/groups/source-group-1",
        categoryId: "category-1",
        entryRoutes: [],
      },
    };

    await expect(
      new RequestProfileSourceAccessCheckRunUseCase(
        context.checkRuns,
        context.profiles,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    ).rejects.toThrow(SourceGroupLookupFailedError);
  });

  it("rejects check run request if source group is paused", async () => {
    const context = createTestContext(["check-run-1"]);
    context.sourceGroups.result = {
      ok: true,
      statusCode: 200,
      sourceGroup: {
        id: "source-group-1",
        platform: "FACEBOOK",
        status: "PAUSED",
        url: "https://www.facebook.com/groups/source-group-1",
        categoryId: "category-1",
        entryRoutes: [],
      },
    };

    await expect(
      new RequestProfileSourceAccessCheckRunUseCase(
        context.checkRuns,
        context.profiles,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    ).rejects.toThrow(ProfileSourceAccessCheckRunSourceGroupNotActiveError);
  });

  it("gets a check run", async () => {
    const context = createTestContext(["check-run-1"]);

    const requested = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    const get = await new GetProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
    ).execute({ checkRunId: requested.id });

    expect(get).toEqual(requested);
  });

  it("cancels a queued check run", async () => {
    const context = createTestContext(["check-run-1"]);
    const requested = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    context.clock.nowResult = new Date(updatedAt);

    const canceled = await new CancelProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.clock,
    ).execute({ checkRunId: requested.id });

    expect(canceled.status).toBe("CANCELED");
    expect(canceled.finishedAt).toBe(updatedAt);
    expect(canceled.updatedAt).toBe(updatedAt);
  });

  it("marks a queued check run as running", async () => {
    const context = createTestContext(["check-run-1"]);
    const requested = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    context.clock.nowResult = new Date(updatedAt);

    const running = await new MarkProfileSourceAccessCheckRunRunningUseCase(
      context.checkRuns,
      context.clock,
    ).execute({ checkRunId: requested.id });

    expect(running.status).toBe("RUNNING");
    expect(running.startedAt).toBe(updatedAt);
    expect(running.updatedAt).toBe(updatedAt);
  });

  it("marks a running check run as succeeded", async () => {
    const context = createTestContext(["check-run-1"]);
    const requested = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    context.clock.nowResult = new Date(updatedAt);

    await new MarkProfileSourceAccessCheckRunRunningUseCase(
      context.checkRuns,
      context.clock,
    ).execute({ checkRunId: requested.id });

    const succeeded = await new MarkProfileSourceAccessCheckRunSucceededUseCase(
      context.checkRuns,
      context.clock,
    ).execute({ checkRunId: requested.id });

    expect(succeeded.status).toBe("SUCCEEDED");
    expect(succeeded.finishedAt).toBe(updatedAt);
    expect(succeeded.updatedAt).toBe(updatedAt);
  });

  it("marks a running check run as failed", async () => {
    const context = createTestContext(["check-run-1"]);
    const requested = await new RequestProfileSourceAccessCheckRunUseCase(
      context.checkRuns,
      context.profiles,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    context.clock.nowResult = new Date(updatedAt);

    await new MarkProfileSourceAccessCheckRunRunningUseCase(
      context.checkRuns,
      context.clock,
    ).execute({ checkRunId: requested.id });

    const failed = await new MarkProfileSourceAccessCheckRunFailedUseCase(
      context.checkRuns,
      context.clock,
    ).execute({
      checkRunId: requested.id,
      failureReason: {
        code: "WORKER_FAILED",
        message: "Worker crashed",
      },
    });

    expect(failed.status).toBe("FAILED");
    expect(failed.failureReason).toEqual({
      code: "WORKER_FAILED",
      message: "Worker crashed",
    });
    expect(failed.finishedAt).toBe(updatedAt);
    expect(failed.updatedAt).toBe(updatedAt);
  });
});

function createTestContext(idSequence: string[] = []) {
  const checkRuns = new InMemoryProfileSourceAccessCheckRunRepository();
  const sourceGroups = new FakeSourceGroupLookupPort();
  const profiles = new FakeProfileReferencePort();
  const ids = new FakeIdGenerator(idSequence);
  const clock = new FakeClock(new Date(createdAt));

  return {
    checkRuns,
    sourceGroups,
    profiles,
    ids,
    clock,
  };
}

class FakeIdGenerator implements IdGenerator {
  public constructor(private readonly sequence: string[]) {}

  public async generateId(): Promise<string> {
    const id = this.sequence.shift();

    if (id === undefined) {
      throw new Error("No more IDs in test sequence");
    }

    return id;
  }
}

class FakeClock implements Clock {
  public constructor(public nowResult: Date) {}

  public now(): Date {
    return this.nowResult;
  }
}

class FakeSourceGroupLookupPort implements SourceGroupLookupPort {
  public result: SourceGroupLookupResult = {
    ok: true,
    statusCode: 200,
    sourceGroup: {
      id: "source-group-1",
      platform: "FACEBOOK",
      status: "ACTIVE",
      url: "https://www.facebook.com/groups/source-group-1",
      categoryId: "category-1",
      entryRoutes: [],
    },
  };

  public async getSourceGroup(): Promise<SourceGroupLookupResult> {
    return this.result;
  }
}

class FakeProfileReferencePort implements ProfileReferencePort {
  public result: ProfileReferenceResult = {
    ok: true,
    profileId: "profile-1",
    accountStage: "WARMING",
  };

  public async getProfileAccountStage(): Promise<ProfileReferenceResult> {
    return this.result;
  }
}
