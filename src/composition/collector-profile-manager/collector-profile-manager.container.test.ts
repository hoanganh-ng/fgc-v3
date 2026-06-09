import { describe, expect, it } from "vitest";
import {
  CheckoutProfileUseCase,
  CreateProfileUseCase,
  GetProfileUseCase,
  GetProvisioningConfigurationUseCase,
  GetRuntimeProfileConfigurationUseCase,
  IngestProfileSessionUseCase,
  ListProfilesUseCase,
  ReleaseProfileLeaseUseCase,
  StartProfileProvisioningUseCase,
  UpdateProfileConfigurationUseCase,
} from "../../collector-profile-manager/application";
import type {
  Clock,
  LeaseIdGenerator,
  TokenGenerator,
} from "../../collector-profile-manager/application";
import { InMemoryProfileLeaseRepository, InMemoryProfileRepository } from "../../collector-profile-manager/application/test-support/in-memory-repositories";
import type { ProfileLeaseId } from "../../collector-profile-manager/domain";
import { createCollectorProfileManager } from "./collector-profile-manager.container";

describe("collector profile manager composition container", () => {
  it("creates all expected services from supplied dependencies", async () => {
    let closed = false;
    const services = createCollectorProfileManager({
      profiles: new InMemoryProfileRepository(),
      leases: new InMemoryProfileLeaseRepository(),
      clock: new FixedClock(),
      tokenGenerator: new FakeTokenGenerator(),
      leaseIdGenerator: new FakeLeaseIdGenerator(),
      close: async () => {
        closed = true;
      },
    });

    expect(services.createProfile).toBeInstanceOf(CreateProfileUseCase);
    expect(services.getProfile).toBeInstanceOf(GetProfileUseCase);
    expect(services.listProfiles).toBeInstanceOf(ListProfilesUseCase);
    expect(services.updateProfileConfiguration).toBeInstanceOf(
      UpdateProfileConfigurationUseCase,
    );
    expect(services.startProfileProvisioning).toBeInstanceOf(
      StartProfileProvisioningUseCase,
    );
    expect(services.getProvisioningConfiguration).toBeInstanceOf(
      GetProvisioningConfigurationUseCase,
    );
    expect(services.getRuntimeProfileConfiguration).toBeInstanceOf(
      GetRuntimeProfileConfigurationUseCase,
    );
    expect(services.ingestProfileSession).toBeInstanceOf(
      IngestProfileSessionUseCase,
    );
    expect(services.checkoutProfile).toBeInstanceOf(CheckoutProfileUseCase);
    expect(services.releaseProfileLease).toBeInstanceOf(
      ReleaseProfileLeaseUseCase,
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

class FakeTokenGenerator implements TokenGenerator {
  public async generateToken(): Promise<string> {
    return "token-1";
  }
}

class FakeLeaseIdGenerator implements LeaseIdGenerator {
  public async generateLeaseId(): Promise<ProfileLeaseId> {
    return "lease-1";
  }
}
