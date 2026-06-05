import { describe, expect, it } from "vitest";
import {
  createActiveProfileLease,
} from "../../../collector-profile-manager/domain";
import {
  InvalidPersistedProfileLeaseError,
  toProfileLeaseDomain,
  toProfileLeaseRow,
} from "./profile-lease.mapper";

const leasedAt = "2026-01-05T18:00:00.000Z";
const expiresAt = "2026-01-05T18:45:00.000Z";

describe("profile lease database mapper", () => {
  it("maps leases to rows and back", () => {
    const lease = createActiveProfileLease({
      id: "lease-1",
      profileId: "profile-1",
      leasedAt,
      expiresAt,
    });
    const row = toProfileLeaseRow(lease);

    expect(toProfileLeaseDomain(row)).toEqual(lease);
  });

  it("rejects invalid persisted lease data on read", () => {
    const lease = createActiveProfileLease({
      id: "lease-1",
      profileId: "profile-1",
      leasedAt,
      expiresAt,
    });
    const row = {
      ...toProfileLeaseRow(lease),
      expiresAt: "2026-01-05T17:59:00.000Z",
    };

    expect(() => toProfileLeaseDomain(row)).toThrow(
      InvalidPersistedProfileLeaseError,
    );
  });
});
