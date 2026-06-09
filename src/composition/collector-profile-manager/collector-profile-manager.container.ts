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
  ProfileLeaseRepository,
  ProfileRepository,
  TokenGenerator,
  TransactionManager,
} from "../../collector-profile-manager/application";

export interface CollectorProfileManagerDependencies {
  readonly profiles: ProfileRepository;
  readonly leases: ProfileLeaseRepository;
  readonly clock: Clock;
  readonly tokenGenerator: TokenGenerator;
  readonly leaseIdGenerator: LeaseIdGenerator;
  readonly transactionManager?: TransactionManager;
  readonly close?: () => Promise<void>;
}

export interface CollectorProfileManagerContainer {
  readonly createProfile: CreateProfileUseCase;
  readonly getProfile: GetProfileUseCase;
  readonly listProfiles: ListProfilesUseCase;
  readonly updateProfileConfiguration: UpdateProfileConfigurationUseCase;
  readonly startProfileProvisioning: StartProfileProvisioningUseCase;
  readonly getProvisioningConfiguration: GetProvisioningConfigurationUseCase;
  readonly getRuntimeProfileConfiguration: GetRuntimeProfileConfigurationUseCase;
  readonly ingestProfileSession: IngestProfileSessionUseCase;
  readonly checkoutProfile: CheckoutProfileUseCase;
  readonly releaseProfileLease: ReleaseProfileLeaseUseCase;
  close(): Promise<void>;
}

export function createCollectorProfileManager(
  dependencies: CollectorProfileManagerDependencies,
): CollectorProfileManagerContainer {
  const {
    profiles,
    leases,
    clock,
    tokenGenerator,
    leaseIdGenerator,
    transactionManager,
  } = dependencies;

  return {
    createProfile: new CreateProfileUseCase(profiles, clock),
    getProfile: new GetProfileUseCase(profiles),
    listProfiles: new ListProfilesUseCase(profiles),
    updateProfileConfiguration: new UpdateProfileConfigurationUseCase(
      profiles,
      clock,
    ),
    startProfileProvisioning: new StartProfileProvisioningUseCase(
      profiles,
      tokenGenerator,
      clock,
    ),
    getProvisioningConfiguration: new GetProvisioningConfigurationUseCase(
      profiles,
      clock,
    ),
    getRuntimeProfileConfiguration: new GetRuntimeProfileConfigurationUseCase(
      profiles,
      leases,
      clock,
    ),
    ingestProfileSession: new IngestProfileSessionUseCase(profiles, clock),
    checkoutProfile: new CheckoutProfileUseCase(
      profiles,
      leases,
      leaseIdGenerator,
      clock,
      transactionManager,
    ),
    releaseProfileLease: new ReleaseProfileLeaseUseCase(
      profiles,
      leases,
      clock,
      transactionManager,
    ),
    close: dependencies.close ?? noopClose,
  };
}

async function noopClose(): Promise<void> {}
