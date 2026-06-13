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
  ProfileLeaseRepository,
  ProfileRepository,
  ProfileSourceAccessRepository,
  SourceGroupReferencePort,
  TokenGenerator,
  TransactionManager,
} from "../../collector-profile-manager/application";

export interface CollectorProfileManagerDependencies {
  readonly profiles: ProfileRepository;
  readonly leases: ProfileLeaseRepository;
  readonly profileSourceAccess: ProfileSourceAccessRepository;
  readonly sourceGroupReference: SourceGroupReferencePort;
  readonly clock: Clock;
  readonly tokenGenerator: TokenGenerator;
  readonly leaseIdGenerator: LeaseIdGenerator;
  readonly idGenerator: IdGenerator;
  readonly transactionManager?: TransactionManager;
  readonly close?: () => Promise<void>;
}

export interface CollectorProfileManagerContainer {
  readonly createProfile: CreateProfileUseCase;
  readonly getProfile: GetProfileUseCase;
  readonly listProfiles: ListProfilesUseCase;
  readonly updateProfileConfiguration: UpdateProfileConfigurationUseCase;
  readonly updateProfileAccountStage: UpdateProfileAccountStageUseCase;
  readonly startProfileProvisioning: StartProfileProvisioningUseCase;
  readonly getProvisioningConfiguration: GetProvisioningConfigurationUseCase;
  readonly getRuntimeProfileConfiguration: GetRuntimeProfileConfigurationUseCase;
  readonly ingestProfileSession: IngestProfileSessionUseCase;
  readonly checkoutProfile: CheckoutProfileUseCase;
  readonly checkoutProfileForExercise: CheckoutProfileForExerciseUseCase;
  readonly releaseProfileLease: ReleaseProfileLeaseUseCase;
  readonly upsertProfileSourceAccess: UpsertProfileSourceAccessUseCase;
  readonly getProfileSourceAccess: GetProfileSourceAccessUseCase;
  readonly listProfileSourceAccessForProfile: ListProfileSourceAccessForProfileUseCase;
  readonly listProfileSourceAccessForSourceGroup: ListProfileSourceAccessForSourceGroupUseCase;
  close(): Promise<void>;
}

export function createCollectorProfileManager(
  dependencies: CollectorProfileManagerDependencies,
): CollectorProfileManagerContainer {
  const {
    profiles,
    leases,
    profileSourceAccess,
    sourceGroupReference,
    clock,
    tokenGenerator,
    leaseIdGenerator,
    idGenerator,
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
    updateProfileAccountStage: new UpdateProfileAccountStageUseCase(
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
      sourceGroupReference,
      profileSourceAccess,
      transactionManager,
    ),
    checkoutProfileForExercise: new CheckoutProfileForExerciseUseCase(
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
    upsertProfileSourceAccess: new UpsertProfileSourceAccessUseCase(
      profileSourceAccess,
      idGenerator,
      clock,
    ),
    getProfileSourceAccess: new GetProfileSourceAccessUseCase(
      profileSourceAccess,
    ),
    listProfileSourceAccessForProfile:
      new ListProfileSourceAccessForProfileUseCase(profileSourceAccess),
    listProfileSourceAccessForSourceGroup:
      new ListProfileSourceAccessForSourceGroupUseCase(profileSourceAccess),
    close: dependencies.close ?? noopClose,
  };
}

async function noopClose(): Promise<void> {}
