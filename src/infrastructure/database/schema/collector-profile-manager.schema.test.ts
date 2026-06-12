import { describe, expect, it } from "vitest";
import {
  collectorProfileLeaseStatusEnum,
  collectorProfileLeases,
  collectorProfileAccountStageEnum,
  collectorProfileStatusEnum,
  collectorProfiles,
  provisioningTokenStatusEnum,
} from "./collector-profile-manager.schema";

describe("collector profile manager database schema", () => {
  it("exports profile table metadata for migration generation", () => {
    expect(collectorProfiles.id.name).toBe("profile_id");
    expect(collectorProfiles.status.name).toBe("status");
    expect(collectorProfiles.accountStage.name).toBe("account_stage");
    expect(collectorProfiles.nextAvailableAt.name).toBe("next_available_at");
    expect(collectorProfiles.networkContext.name).toBe("network_context");
    expect(collectorProfiles.authenticationState.name).toBe(
      "authentication_state",
    );
  });

  it("exports lease table metadata for migration generation", () => {
    expect(collectorProfileLeases.id.name).toBe("lease_id");
    expect(collectorProfileLeases.profileId.name).toBe("profile_id");
    expect(collectorProfileLeases.status.name).toBe("status");
    expect(collectorProfileLeases.expiresAt.name).toBe("expires_at");
  });

  it("keeps database enum values aligned with the Collector Profile Manager model", () => {
    expect(collectorProfileStatusEnum.enumValues).toEqual([
      "PENDING_CONFIG",
      "PENDING_LOGIN",
      "READY",
      "BUSY",
    ]);
    expect(collectorProfileAccountStageEnum.enumValues).toEqual([
      "NEW_ACCOUNT",
      "WARMING",
      "COLLECTION_READY",
      "LIMITED",
      "NEEDS_REVIEW",
      "RETIRED",
    ]);
    expect(provisioningTokenStatusEnum.enumValues).toEqual([
      "NOT_ISSUED",
      "ISSUED",
      "CONSUMED",
      "EXPIRED",
    ]);
    expect(collectorProfileLeaseStatusEnum.enumValues).toEqual([
      "ACTIVE",
      "RELEASED",
      "EXPIRED",
    ]);
  });
});
