import { describe, expect, it } from "vitest";
import {
  collectorProfileLeasePurposeEnum,
  collectorProfileLeaseStatusEnum,
  collectorProfileLeases,
  collectorProfileAccountStageEnum,
  collectorProfileSourceAccess,
  collectorProfileSourceAccessStateEnum,
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
    expect(collectorProfileLeases.purpose.name).toBe("purpose");
    expect(collectorProfileLeases.status.name).toBe("status");
    expect(collectorProfileLeases.expiresAt.name).toBe("expires_at");
  });

  it("exports profile-source access table metadata for migration generation", () => {
    expect(collectorProfileSourceAccess.id.name).toBe("id");
    expect(collectorProfileSourceAccess.profileId.name).toBe("profile_id");
    expect(collectorProfileSourceAccess.sourceGroupId.name).toBe(
      "source_group_id",
    );
    expect(collectorProfileSourceAccess.accessState.name).toBe("access_state");
    expect(collectorProfileSourceAccess.lastFailureReason.name).toBe(
      "last_failure_reason",
    );
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
    expect(collectorProfileLeasePurposeEnum.enumValues).toEqual([
      "COLLECTION",
      "AMBIENT_EXERCISE",
      "ASSISTED_GROUP_ACCESS",
    ]);
    expect(collectorProfileSourceAccessStateEnum.enumValues).toEqual([
      "UNKNOWN",
      "PUBLIC_ACCESSIBLE",
      "JOIN_REQUIRED",
      "JOIN_REQUESTED",
      "JOINED_ACCESSIBLE",
      "ACCESS_DENIED",
      "LOGIN_REQUIRED",
      "CHECKPOINT_REQUIRED",
      "NEEDS_MANUAL_REVIEW",
    ]);
  });
});
