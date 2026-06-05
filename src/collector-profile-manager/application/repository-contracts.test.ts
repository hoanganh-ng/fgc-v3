import { describe, expect, it } from "vitest";
import {
  createActiveProfileLease,
  createPendingCollectorProfile,
  releaseProfileLease,
} from "../domain";
import type {
  CollectorProfile,
  IsoDateTime,
  ProfileStatus,
  ProvisioningTokenState,
} from "../domain";
import {
  InMemoryProfileLeaseRepository,
  InMemoryProfileRepository,
} from "./test-support/in-memory-repositories";

const createdAt = "2026-01-05T18:00:00.000Z";

describe("collector profile repository contract", () => {
  it("saves and loads profiles by id", async () => {
    const repository = new InMemoryProfileRepository();
    const profile = createProfile("profile-1");

    await repository.save(profile);

    await expect(repository.findById("profile-1")).resolves.toEqual(profile);
    await expect(repository.findById("missing-profile")).resolves.toBeNull();
  });

  it("finds profiles by issued provisioning token", async () => {
    const repository = new InMemoryProfileRepository();
    const issuedProfile = createProfile("profile-issued", "PENDING_LOGIN", {
      status: "ISSUED",
      tokenHash: "token-1",
      issuedAt: createdAt,
      expiresAt: "2026-01-05T18:15:00.000Z",
      consumedAt: null,
    });
    const consumedProfile = createProfile("profile-consumed", "READY", {
      status: "CONSUMED",
      tokenHash: null,
      issuedAt: createdAt,
      expiresAt: "2026-01-05T18:15:00.000Z",
      consumedAt: "2026-01-05T18:02:00.000Z",
    });

    await repository.save(issuedProfile);
    await repository.save(consumedProfile);

    await expect(repository.findByProvisioningToken("token-1")).resolves.toEqual(
      issuedProfile,
    );
    await expect(
      repository.findByProvisioningToken("missing"),
    ).resolves.toBeNull();
  });

  it("finds checkout candidates by status and availability fields", async () => {
    const repository = new InMemoryProfileRepository();
    const readyNow = createProfile("ready-now", "READY");
    const readyAfterCooldown = createProfile(
      "ready-after-cooldown",
      "READY",
      undefined,
      "2026-01-05T17:59:00.000Z",
    );
    const readyInFuture = createProfile(
      "ready-in-future",
      "READY",
      undefined,
      "2026-01-05T18:01:00.000Z",
    );
    const busy = createProfile("busy", "BUSY");

    await repository.save(readyNow);
    await repository.save(readyAfterCooldown);
    await repository.save(readyInFuture);
    await repository.save(busy);

    const candidates = await repository.findCheckoutCandidates({
      status: "READY",
      availableAt: createdAt,
    });

    expect(candidates.map((profile) => profile.identity.id)).toEqual([
      "ready-now",
      "ready-after-cooldown",
    ]);

    const limitedCandidates = await repository.findCheckoutCandidates({
      status: "READY",
      availableAt: createdAt,
      limit: 1,
    });

    expect(limitedCandidates.map((profile) => profile.identity.id)).toEqual([
      "ready-now",
    ]);
  });
});

describe("profile lease repository contract", () => {
  it("saves, loads, and updates lease status", async () => {
    const repository = new InMemoryProfileLeaseRepository();
    const lease = createActiveProfileLease({
      id: "lease-1",
      profileId: "profile-1",
      leasedAt: createdAt,
      expiresAt: "2026-01-05T18:45:00.000Z",
    });

    await repository.save(lease);

    await expect(repository.findById("lease-1")).resolves.toEqual(lease);
    await expect(repository.findActiveByProfileId("profile-1")).resolves.toEqual(
      lease,
    );

    const releasedLease = releaseProfileLease(
      lease,
      "2026-01-05T18:10:00.000Z",
    );

    await repository.updateStatus(releasedLease);

    await expect(repository.findById("lease-1")).resolves.toEqual(releasedLease);
    await expect(
      repository.findActiveByProfileId("profile-1"),
    ).resolves.toBeNull();
  });
});

function createProfile(
  id: string,
  status: ProfileStatus = "PENDING_CONFIG",
  provisioningToken?: ProvisioningTokenState,
  nextAvailableAt: IsoDateTime | null = null,
): CollectorProfile {
  const profile = createPendingCollectorProfile({
    id,
    displayName: id,
    createdAt,
  });

  return {
    ...profile,
    identity: {
      ...profile.identity,
      status,
      nextAvailableAt,
    },
    provisioningToken: provisioningToken ?? profile.provisioningToken,
  };
}
