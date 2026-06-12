import { describe, expect, it } from "vitest";
import {
  GetProfileSourceAccessUseCase,
  InvalidProfileSourceAccessError,
  ListProfileSourceAccessForProfileUseCase,
  ListProfileSourceAccessForSourceGroupUseCase,
  ProfileSourceAccessNotFoundError,
  UpsertProfileSourceAccessUseCase,
} from "./index";
import type { Clock, IdGenerator } from "./index";
import {
  InMemoryProfileSourceAccessRepository,
} from "./test-support/in-memory-repositories";
import type {
  ProfileSourceAccessFailureReason,
  ProfileSourceAccessState,
} from "../domain";

describe("profile-source access application use cases", () => {
  it("creates and gets a profile-source access record", async () => {
    const context = createTestContext();
    const created = await upsert(context, {
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "UNKNOWN",
    });
    const loaded = await new GetProfileSourceAccessUseCase(
      context.profileSourceAccess,
    ).execute({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    expect(created).toEqual({
      id: "access-1",
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "UNKNOWN",
      lastCheckedAt: "2026-01-01T10:00:00.000Z",
      lastSuccessfulAt: null,
      lastFailureReason: null,
      joinRequestedAt: null,
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
    });
    expect(loaded).toEqual(created);
  });

  it("updates an existing record and preserves its id and createdAt", async () => {
    const context = createTestContext();
    const created = await upsert(context, {
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "UNKNOWN",
    });

    context.clock.set("2026-01-01T10:05:00.000Z");

    const updated = await upsert(context, {
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "JOIN_REQUIRED",
      notes: "Requires manual join review.",
    });
    const byProfile = await context.profileSourceAccess.listByProfile(
      "profile-1",
    );

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBe("2026-01-01T10:05:00.000Z");
    expect(updated.lastCheckedAt).toBe("2026-01-01T10:05:00.000Z");
    expect(updated.notes).toBe("Requires manual join review.");
    expect(byProfile).toHaveLength(1);
  });

  it("sets success timestamps for public and joined access states", async () => {
    const context = createTestContext();
    const publicAccess = await upsert(context, {
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "PUBLIC_ACCESSIBLE",
    });

    context.clock.set("2026-01-01T10:10:00.000Z");

    const joinedAccess = await upsert(context, {
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "JOINED_ACCESSIBLE",
    });

    expect(publicAccess.lastSuccessfulAt).toBe(
      "2026-01-01T10:00:00.000Z",
    );
    expect(joinedAccess.lastSuccessfulAt).toBe(
      "2026-01-01T10:10:00.000Z",
    );
  });

  it("sets joinRequestedAt when state becomes JOIN_REQUESTED", async () => {
    const context = createTestContext();
    const access = await upsert(context, {
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "JOIN_REQUESTED",
    });

    expect(access.joinRequestedAt).toBe("2026-01-01T10:00:00.000Z");
  });

  it("stores sanitized failure reasons for failure states", async () => {
    const context = createTestContext();
    const failureReason = {
      code: "ACCESS_DENIED",
      message: "Access denied by group visibility.",
      cookies: ["not-stored"],
      rawPayload: { private: true },
    } as unknown as ProfileSourceAccessFailureReason;
    const access = await upsert(context, {
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "ACCESS_DENIED",
      lastFailureReason: failureReason,
    });

    expect(access.lastFailureReason).toEqual({
      code: "ACCESS_DENIED",
      message: "Access denied by group visibility.",
    });
    expect(access.lastFailureReason).not.toHaveProperty("cookies");
    expect(access.lastFailureReason).not.toHaveProperty("rawPayload");
  });

  it("lists by profile and by source group", async () => {
    const context = createTestContext(["access-1", "access-2", "access-3"]);

    await upsert(context, {
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "UNKNOWN",
    });
    context.clock.set("2026-01-01T10:01:00.000Z");
    await upsert(context, {
      profileId: "profile-1",
      sourceGroupId: "source-group-2",
      accessState: "JOIN_REQUIRED",
    });
    context.clock.set("2026-01-01T10:02:00.000Z");
    await upsert(context, {
      profileId: "profile-2",
      sourceGroupId: "source-group-1",
      accessState: "PUBLIC_ACCESSIBLE",
    });

    const byProfile = await new ListProfileSourceAccessForProfileUseCase(
      context.profileSourceAccess,
    ).execute({ profileId: "profile-1" });
    const bySourceGroup =
      await new ListProfileSourceAccessForSourceGroupUseCase(
        context.profileSourceAccess,
      ).execute({ sourceGroupId: "source-group-1" });

    expect(byProfile.map((item) => item.sourceGroupId)).toEqual([
      "source-group-2",
      "source-group-1",
    ]);
    expect(bySourceGroup.map((item) => item.profileId)).toEqual([
      "profile-2",
      "profile-1",
    ]);
  });

  it("rejects invalid access states", async () => {
    const context = createTestContext();

    await expect(
      upsert(context, {
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
        accessState: "NOT_A_STATE" as ProfileSourceAccessState,
      }),
    ).rejects.toThrow(InvalidProfileSourceAccessError);
  });

  it("returns safe DTOs only", async () => {
    const context = createTestContext();
    const access = await upsert(context, {
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "LOGIN_REQUIRED",
      lastFailureReason: {
        code: "LOGIN_REQUIRED",
        message: "Login required before access can be checked.",
      },
    });

    expect(access).not.toHaveProperty("cookies");
    expect(access).not.toHaveProperty("localStorage");
    expect(access).not.toHaveProperty("proxy");
    expect(access).not.toHaveProperty("authenticationState");
    expect(access).not.toHaveProperty("provisioningToken");
    expect(access).not.toHaveProperty("tokenHash");
    expect(access).not.toHaveProperty("trustedRuntimeConfiguration");
    expect(access).not.toHaveProperty("rawPayload");
  });

  it("throws a typed error when a record is missing", async () => {
    const context = createTestContext();

    await expect(
      new GetProfileSourceAccessUseCase(
        context.profileSourceAccess,
      ).execute({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    ).rejects.toThrow(ProfileSourceAccessNotFoundError);
  });
});

interface TestContext {
  readonly profileSourceAccess: InMemoryProfileSourceAccessRepository;
  readonly ids: FakeIdGenerator;
  readonly clock: MutableClock;
}

function createTestContext(
  ids: readonly string[] = ["access-1"],
): TestContext {
  return {
    profileSourceAccess: new InMemoryProfileSourceAccessRepository(),
    ids: new FakeIdGenerator(ids),
    clock: new MutableClock("2026-01-01T10:00:00.000Z"),
  };
}

function upsert(
  context: TestContext,
  input: Parameters<UpsertProfileSourceAccessUseCase["execute"]>[0],
): Promise<Awaited<ReturnType<UpsertProfileSourceAccessUseCase["execute"]>>> {
  return new UpsertProfileSourceAccessUseCase(
    context.profileSourceAccess,
    context.ids,
    context.clock,
  ).execute(input);
}

class FakeIdGenerator implements IdGenerator {
  private nextIdIndex = 0;

  public constructor(private readonly ids: readonly string[]) {}

  public async generateId(): Promise<string> {
    const id = this.ids[this.nextIdIndex];
    this.nextIdIndex += 1;

    return id ?? `generated-access-${this.nextIdIndex}`;
  }
}

class MutableClock implements Clock {
  private current: Date;

  public constructor(isoDateTime: string) {
    this.current = new Date(isoDateTime);
  }

  public set(isoDateTime: string): void {
    this.current = new Date(isoDateTime);
  }

  public now(): Date {
    return new Date(this.current.getTime());
  }
}
