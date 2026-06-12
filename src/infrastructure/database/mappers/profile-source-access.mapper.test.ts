import { describe, expect, it } from "vitest";
import type { ProfileSourceAccess } from "../../../collector-profile-manager/domain";
import {
  InvalidPersistedProfileSourceAccessError,
  type ProfileSourceAccessRow,
  toProfileSourceAccessDomain,
  toProfileSourceAccessRow,
} from "./profile-source-access.mapper";

const createdAt = "2026-01-01T10:00:00.000Z";
const updatedAt = "2026-01-01T10:05:00.000Z";

describe("profile-source access database mapper", () => {
  it("maps profile-source access records to rows and back", () => {
    const access = createAccess({
      accessState: "ACCESS_DENIED",
      lastCheckedAt: updatedAt,
      lastFailureReason: {
        code: "ACCESS_DENIED",
        message: "Access denied by group visibility.",
      },
      notes: "Manual review suggested.",
      updatedAt,
    });
    const row = toProfileSourceAccessRow(access);

    expect(row.notes).toBe("Manual review suggested.");
    expect(row.lastFailureReason).toEqual({
      code: "ACCESS_DENIED",
      message: "Access denied by group visibility.",
    });
    expect(toProfileSourceAccessDomain(row)).toEqual(access);
  });

  it("handles nullable fields from persistence", () => {
    const access = createAccess();
    const row = {
      ...toProfileSourceAccessRow(access),
      lastCheckedAt: null,
      lastSuccessfulAt: null,
      lastFailureReason: null,
      joinRequestedAt: null,
      notes: null,
    };
    const domain = toProfileSourceAccessDomain(row);

    expect(domain).toEqual({
      id: "access-1",
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      accessState: "UNKNOWN",
      lastCheckedAt: null,
      lastSuccessfulAt: null,
      lastFailureReason: null,
      joinRequestedAt: null,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it("normalizes Date timestamps from persistence", () => {
    const access = createAccess();
    const row = {
      ...toProfileSourceAccessRow(access),
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
    } as unknown as ProfileSourceAccessRow;
    const domain = toProfileSourceAccessDomain(row);

    expect(domain.createdAt).toBe(createdAt);
    expect(domain.updatedAt).toBe(updatedAt);
  });

  it("rejects invalid persisted profile-source access data on read", () => {
    const access = createAccess();
    const row = {
      ...toProfileSourceAccessRow(access),
      accessState: "NOT_VALID",
    } as unknown as ProfileSourceAccessRow;

    expect(() => toProfileSourceAccessDomain(row)).toThrow(
      InvalidPersistedProfileSourceAccessError,
    );
  });
});

function createAccess(
  options: Partial<ProfileSourceAccess> = {},
): ProfileSourceAccess {
  return {
    id: "access-1",
    profileId: "profile-1",
    sourceGroupId: "source-group-1",
    accessState: "UNKNOWN",
    lastCheckedAt: createdAt,
    lastSuccessfulAt: null,
    lastFailureReason: null,
    joinRequestedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...options,
  };
}
