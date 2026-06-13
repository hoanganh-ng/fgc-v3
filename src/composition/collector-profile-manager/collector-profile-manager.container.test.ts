import { describe, expect, it } from "vitest";
import {
  CheckoutProfileForExerciseUseCase,
  CheckoutProfileUseCase,
  CreateProfileUseCase,
  GetProfileUseCase,
  GetProfileSourceAccessUseCase,
  GetProvisioningConfigurationUseCase,
  GetRuntimeProfileConfigurationUseCase,
  IngestProfileSessionUseCase,
  ListProfileSourceAccessForProfileUseCase,
  ListProfileSourceAccessForSourceGroupUseCase,
  ListProfilesUseCase,
  ReleaseProfileLeaseUseCase,
  StartProfileProvisioningUseCase,
  UpdateProfileAccountStageUseCase,
  UpdateProfileConfigurationUseCase,
  UpsertProfileSourceAccessUseCase,
} from "../../collector-profile-manager/application";
import type {
  Clock,
  IdGenerator,
  LeaseIdGenerator,
  SourceGroupReferencePort,
  TokenGenerator,
} from "../../collector-profile-manager/application";
import {
  InMemoryProfileLeaseRepository,
  InMemoryProfileRepository,
  InMemoryProfileSourceAccessRepository,
} from "../../collector-profile-manager/application/test-support/in-memory-repositories";
import type { ProfileLeaseId } from "../../collector-profile-manager/domain";
import { createCollectorProfileManager } from "./collector-profile-manager.container";

describe("collector profile manager composition container", () => {
  it("creates all expected services from supplied dependencies", async () => {
    let closed = false;
    const services = createCollectorProfileManager({
      profiles: new InMemoryProfileRepository(),
      leases: new InMemoryProfileLeaseRepository(),
      profileSourceAccess: new InMemoryProfileSourceAccessRepository(),
      sourceGroupReference: new FakeSourceGroupReference(),
      clock: new FixedClock(),
      tokenGenerator: new FakeTokenGenerator(),
      leaseIdGenerator: new FakeLeaseIdGenerator(),
      idGenerator: new FakeIdGenerator(),
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
    expect(services.updateProfileAccountStage).toBeInstanceOf(
      UpdateProfileAccountStageUseCase,
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
    expect(services.checkoutProfileForExercise).toBeInstanceOf(
      CheckoutProfileForExerciseUseCase,
    );
    expect(services.releaseProfileLease).toBeInstanceOf(
      ReleaseProfileLeaseUseCase,
    );
    expect(services.upsertProfileSourceAccess).toBeInstanceOf(
      UpsertProfileSourceAccessUseCase,
    );
    expect(services.getProfileSourceAccess).toBeInstanceOf(
      GetProfileSourceAccessUseCase,
    );
    expect(services.listProfileSourceAccessForProfile).toBeInstanceOf(
      ListProfileSourceAccessForProfileUseCase,
    );
    expect(services.listProfileSourceAccessForSourceGroup).toBeInstanceOf(
      ListProfileSourceAccessForSourceGroupUseCase,
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

class FakeIdGenerator implements IdGenerator {
  public async generateId(): Promise<string> {
    return "profile-source-access-1";
  }
}

class FakeSourceGroupReference implements SourceGroupReferencePort {
  public async exists(_sourceGroupId: string): Promise<boolean> {
    return true;
  }
}
