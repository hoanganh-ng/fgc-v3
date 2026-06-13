import type { FastifyInstance } from "fastify";
import {
  ProfileSourceAccessNotFoundError,
} from "../../../collector-profile-manager/application";
import type {
  CheckoutProfileInput,
  CheckoutProfileOutput,
  CheckoutProfileForAssistedGroupAccessInput,
  CheckoutProfileForAssistedGroupAccessOutput,
  CheckoutProfileForExerciseInput,
  CheckoutProfileForExerciseOutput,
  CreateProfileInput,
  GetProfileInput,
  GetProvisioningConfigurationInput,
  GetRuntimeProfileConfigurationInput,
  IngestProfileSessionInput,
  ListProfilesInput,
  ListProfilesOutput,
  ProfileReadNetworkContext,
  ProfileDetail,
  ProfileSourceAccessDto,
  ProvisioningConfiguration,
  ReleaseProfileLeaseInput,
  ReleaseProfileLeaseOutput,
  RuntimeProfileConfiguration,
  SourceGroupReferencePort,
  StartProfileProvisioningInput,
  StartProfileProvisioningOutput,
  UpdateProfileAccountStageInput,
  UpdateProfileConfigurationInput,
  UpsertProfileSourceAccessInput,
  GetProfileSourceAccessInput,
  ListProfileSourceAccessForProfileInput,
  ListProfileSourceAccessForSourceGroupInput,
} from "../../../collector-profile-manager/application";
import type {
  CollectorProfile,
  DailySafetyUsage,
  IsoDateTime,
  NetworkContext,
  ProfileId,
  ProfileAccountStage,
  ProfileStatus,
  ProfileSourceAccessSourceGroupId,
  ProvisioningTokenStatus,
} from "../../../collector-profile-manager/domain";
import { SourceGroupNotFoundError } from "../../../content-manager/application";
import {
  CheckoutProfileHttpBodySchema,
  CheckoutProfileForAssistedGroupAccessHttpBodySchema,
  CreateProfileHttpBodySchema,
  ListProfilesHttpQuerySchema,
  IngestProfileSessionHttpBodySchema,
  ProfileIdHttpParamsSchema,
  ProfileLeaseIdHttpParamsSchema,
  ProfileSourceAccessHttpParamsSchema,
  ProfileSourceAccessSourceGroupHttpParamsSchema,
  ProvisioningTokenHttpParamsSchema,
  ReleaseProfileLeaseHttpBodySchema,
  UpsertProfileSourceAccessHttpBodySchema,
  UpdateProfileAccountStageHttpBodySchema,
  UpdateProfileConfigurationHttpBodySchema,
  checkoutProfileHttpRouteSchema,
  checkoutProfileForAssistedGroupAccessHttpRouteSchema,
  checkoutProfileForExerciseHttpRouteSchema,
  createProfileHttpRouteSchema,
  getProfileSourceAccessHttpRouteSchema,
  getProvisioningConfigurationHttpRouteSchema,
  getProfileHttpRouteSchema,
  getRuntimeProfileConfigurationHttpRouteSchema,
  ingestProfileSessionHttpRouteSchema,
  listProfileSourceAccessForProfileHttpRouteSchema,
  listProfileSourceAccessForSourceGroupHttpRouteSchema,
  listProfilesHttpRouteSchema,
  parseHttpInput,
  releaseProfileLeaseHttpRouteSchema,
  startProfileProvisioningHttpRouteSchema,
  updateProfileAccountStageHttpRouteSchema,
  updateProfileConfigurationHttpRouteSchema,
  upsertProfileSourceAccessHttpRouteSchema,
} from "../schemas/collector-profile-manager.http-schemas";

interface ExecutableUseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

export interface CollectorProfileManagerHttpService {
  readonly createProfile: ExecutableUseCase<
    CreateProfileInput,
    CollectorProfile
  >;
  readonly getProfile: ExecutableUseCase<GetProfileInput, ProfileDetail>;
  readonly listProfiles: ExecutableUseCase<
    ListProfilesInput,
    ListProfilesOutput
  >;
  readonly updateProfileConfiguration: ExecutableUseCase<
    UpdateProfileConfigurationInput,
    CollectorProfile
  >;
  readonly updateProfileAccountStage: ExecutableUseCase<
    UpdateProfileAccountStageInput,
    ProfileDetail
  >;
  readonly startProfileProvisioning: ExecutableUseCase<
    StartProfileProvisioningInput,
    StartProfileProvisioningOutput
  >;
  readonly getProvisioningConfiguration: ExecutableUseCase<
    GetProvisioningConfigurationInput,
    ProvisioningConfiguration
  >;
  readonly getRuntimeProfileConfiguration: ExecutableUseCase<
    GetRuntimeProfileConfigurationInput,
    RuntimeProfileConfiguration
  >;
  readonly ingestProfileSession: ExecutableUseCase<
    IngestProfileSessionInput,
    CollectorProfile
  >;
  readonly checkoutProfile: ExecutableUseCase<
    CheckoutProfileInput | undefined,
    CheckoutProfileOutput
  >;
  readonly checkoutProfileForExercise: ExecutableUseCase<
    CheckoutProfileForExerciseInput,
    CheckoutProfileForExerciseOutput
  >;
  readonly checkoutProfileForAssistedGroupAccess: ExecutableUseCase<
    CheckoutProfileForAssistedGroupAccessInput,
    CheckoutProfileForAssistedGroupAccessOutput
  >;
  readonly releaseProfileLease: ExecutableUseCase<
    ReleaseProfileLeaseInput,
    ReleaseProfileLeaseOutput
  >;
  readonly upsertProfileSourceAccess: ExecutableUseCase<
    UpsertProfileSourceAccessInput,
    ProfileSourceAccessDto
  >;
  readonly getProfileSourceAccess: ExecutableUseCase<
    GetProfileSourceAccessInput,
    ProfileSourceAccessDto
  >;
  readonly listProfileSourceAccessForProfile: ExecutableUseCase<
    ListProfileSourceAccessForProfileInput,
    readonly ProfileSourceAccessDto[]
  >;
  readonly listProfileSourceAccessForSourceGroup: ExecutableUseCase<
    ListProfileSourceAccessForSourceGroupInput,
    readonly ProfileSourceAccessDto[]
  >;
}

export interface RegisterCollectorProfileManagerRoutesOptions {
  readonly collectorProfileManager: CollectorProfileManagerHttpService;
  readonly sourceGroupReferences: SourceGroupReferencePort;
}

interface ProfileSummary {
  readonly id: ProfileId;
  readonly displayName: string;
  readonly status: ProfileStatus;
  readonly accountStage: ProfileAccountStage;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly lastCheckoutAt: IsoDateTime | null;
  readonly lastReleasedAt: IsoDateTime | null;
  readonly nextAvailableAt: IsoDateTime | null;
  readonly dailyUsage: DailySafetyUsage;
  readonly hasHardwareFingerprint: boolean;
  readonly hasAuthenticationState: boolean;
  readonly provisioningTokenStatus: ProvisioningTokenStatus;
}

export function registerCollectorProfileManagerRoutes(
  server: FastifyInstance,
  options: RegisterCollectorProfileManagerRoutesOptions,
): void {
  const { collectorProfileManager, sourceGroupReferences } = options;

  server.get(
    "/collector/profiles",
    { schema: listProfilesHttpRouteSchema },
    async (request) => {
      const query = parseHttpInput(
        ListProfilesHttpQuerySchema,
        request.query,
      );
      const input = {
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.limit !== undefined ? { limit: query.limit } : {}),
        ...(query.offset !== undefined ? { offset: query.offset } : {}),
      } satisfies ListProfilesInput;

      return collectorProfileManager.listProfiles.execute(input);
    },
  );

  server.get(
    "/collector/profiles/:profileId",
    { schema: getProfileHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileIdHttpParamsSchema,
        request.params,
      );
      const profile = await collectorProfileManager.getProfile.execute({
        profileId: params.profileId,
      });

      return {
        profile,
      };
    },
  );

  server.post(
    "/collector/profiles",
    { schema: createProfileHttpRouteSchema },
    async (request, reply) => {
      const body = parseHttpInput(
        CreateProfileHttpBodySchema,
        request.body,
      );
      const profile = await collectorProfileManager.createProfile.execute(body);

      return reply.code(201).send({
        profile: toProfileSummary(profile),
      });
    },
  );

  server.patch(
    "/collector/profiles/:profileId/configuration",
    { schema: updateProfileConfigurationHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        UpdateProfileConfigurationHttpBodySchema,
        request.body,
      );
      const input = {
        profileId: params.profileId,
        ...(body.networkContext !== undefined
          ? { networkContext: body.networkContext }
          : {}),
        ...(body.hardwareFingerprint !== undefined
          ? { hardwareFingerprint: body.hardwareFingerprint }
          : {}),
        ...(body.behavioralPersona !== undefined
          ? { behavioralPersona: body.behavioralPersona }
          : {}),
        ...(body.temporalRoutine !== undefined
          ? { temporalRoutine: body.temporalRoutine }
          : {}),
        ...(body.safetyThresholds !== undefined
          ? { safetyThresholds: body.safetyThresholds }
          : {}),
        ...(body.contentAffinities !== undefined
          ? { contentAffinities: body.contentAffinities }
          : {}),
      } satisfies UpdateProfileConfigurationInput;
      const profile =
        await collectorProfileManager.updateProfileConfiguration.execute(input);

      return {
        profile: toProfileSummary(profile),
      };
    },
  );

  server.patch(
    "/collector/profiles/:profileId/account-stage",
    { schema: updateProfileAccountStageHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        UpdateProfileAccountStageHttpBodySchema,
        request.body,
      );
      const profile =
        await collectorProfileManager.updateProfileAccountStage.execute({
          profileId: params.profileId,
          accountStage: body.accountStage,
        });

      return {
        profile,
      };
    },
  );

  server.post(
    "/collector/profiles/:profileId/provisioning/start",
    { schema: startProfileProvisioningHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileIdHttpParamsSchema,
        request.params,
      );
      const output =
        await collectorProfileManager.startProfileProvisioning.execute({
          profileId: params.profileId,
        });

      return {
        profile: toProfileSummary(output.profile),
        provisioningToken: output.provisioningToken,
        expiresAt: output.expiresAt,
      };
    },
  );

  server.get(
    "/collector/provisioning/:token/configuration",
    { schema: getProvisioningConfigurationHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProvisioningTokenHttpParamsSchema,
        request.params,
      );

      const configuration =
        await collectorProfileManager.getProvisioningConfiguration.execute({
          provisioningToken: params.token,
        });

      return configuration;
    },
  );

  server.post(
    "/collector/provisioning/:token/session",
    { schema: ingestProfileSessionHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProvisioningTokenHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        IngestProfileSessionHttpBodySchema,
        request.body,
      );
      const input = {
        provisioningToken: params.token,
        cookies: body.cookies,
        localStorage: body.localStorage,
        ...(body.sessionExpiresAt !== undefined
          ? { sessionExpiresAt: body.sessionExpiresAt }
          : {}),
      } satisfies IngestProfileSessionInput;
      const profile =
        await collectorProfileManager.ingestProfileSession.execute(input);

      return {
        profile: toProfileSummary(profile),
      };
    },
  );

  server.post(
    "/collector/profiles/checkout",
    { schema: checkoutProfileHttpRouteSchema },
    async (request) => {
      const body = parseHttpInput(
        CheckoutProfileHttpBodySchema,
        request.body ?? {},
      );
      const input: CheckoutProfileInput = {
        sourceGroupId: body.sourceGroupId,
        ...(body.profileId !== undefined ? { profileId: body.profileId } : {}),
      };

      return collectorProfileManager.checkoutProfile.execute(input);
    },
  );

  server.post(
    "/collector/profiles/:profileId/exercise-checkout",
    { schema: checkoutProfileForExerciseHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileIdHttpParamsSchema,
        request.params,
      );

      return collectorProfileManager.checkoutProfileForExercise.execute({
        profileId: params.profileId,
      });
    },
  );

  server.post(
    "/collector/profiles/:profileId/assisted-group-access/checkout",
    { schema: checkoutProfileForAssistedGroupAccessHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        CheckoutProfileForAssistedGroupAccessHttpBodySchema,
        request.body,
      );

      return collectorProfileManager.checkoutProfileForAssistedGroupAccess.execute(
        {
          profileId: params.profileId,
          sourceGroupId: body.sourceGroupId,
        },
      );
    },
  );

  server.post(
    "/collector/profile-leases/:leaseId/release",
    { schema: releaseProfileLeaseHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileLeaseIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        ReleaseProfileLeaseHttpBodySchema,
        request.body ?? {},
      );
      const input = {
        leaseId: params.leaseId,
        ...(body.macroActionsPerformed !== undefined
          ? { macroActionsPerformed: body.macroActionsPerformed }
          : {}),
      } satisfies ReleaseProfileLeaseInput;
      const output =
        await collectorProfileManager.releaseProfileLease.execute(input);

      return {
        lease: output.lease,
        profile: toProfileSummary(output.profile),
      };
    },
  );

  server.get(
    "/collector/profile-leases/:leaseId/runtime-configuration",
    { schema: getRuntimeProfileConfigurationHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileLeaseIdHttpParamsSchema,
        request.params,
      );

      return collectorProfileManager.getRuntimeProfileConfiguration.execute({
        leaseId: params.leaseId,
      });
    },
  );

  server.put(
    "/collector/profiles/:profileId/source-access/:sourceGroupId",
    { schema: upsertProfileSourceAccessHttpRouteSchema },
    async (request, reply) => {
      const params = parseHttpInput(
        ProfileSourceAccessHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        UpsertProfileSourceAccessHttpBodySchema,
        request.body,
      );

      await ensureProfileExists(collectorProfileManager, params.profileId);
      await ensureSourceGroupExists(
        sourceGroupReferences,
        params.sourceGroupId,
      );
      const existed = await profileSourceAccessExists(
        collectorProfileManager,
        params.profileId,
        params.sourceGroupId,
      );
      const profileSourceAccess =
        await collectorProfileManager.upsertProfileSourceAccess.execute({
          profileId: params.profileId,
          sourceGroupId: params.sourceGroupId,
          accessState: body.accessState,
          ...(body.lastFailureReason !== undefined
            ? { lastFailureReason: body.lastFailureReason }
            : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        });

      return reply.code(existed ? 200 : 201).send({
        profileSourceAccess,
      });
    },
  );

  server.get(
    "/collector/profiles/:profileId/source-access",
    { schema: listProfileSourceAccessForProfileHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileIdHttpParamsSchema,
        request.params,
      );

      await ensureProfileExists(collectorProfileManager, params.profileId);
      const items =
        await collectorProfileManager.listProfileSourceAccessForProfile.execute(
          {
            profileId: params.profileId,
          },
        );

      return { items };
    },
  );

  server.get(
    "/collector/profiles/:profileId/source-access/:sourceGroupId",
    { schema: getProfileSourceAccessHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileSourceAccessHttpParamsSchema,
        request.params,
      );

      await ensureProfileExists(collectorProfileManager, params.profileId);
      await ensureSourceGroupExists(
        sourceGroupReferences,
        params.sourceGroupId,
      );
      const profileSourceAccess =
        await collectorProfileManager.getProfileSourceAccess.execute({
          profileId: params.profileId,
          sourceGroupId: params.sourceGroupId,
        });

      return {
        profileSourceAccess,
      };
    },
  );

  server.get(
    "/collector/source-groups/:sourceGroupId/profile-access",
    { schema: listProfileSourceAccessForSourceGroupHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ProfileSourceAccessSourceGroupHttpParamsSchema,
        request.params,
      );

      await ensureSourceGroupExists(
        sourceGroupReferences,
        params.sourceGroupId,
      );
      const items =
        await collectorProfileManager.listProfileSourceAccessForSourceGroup.execute(
          {
            sourceGroupId: params.sourceGroupId,
          },
        );

      return { items };
    },
  );
}

async function ensureProfileExists(
  collectorProfileManager: CollectorProfileManagerHttpService,
  profileId: ProfileId,
): Promise<void> {
  await collectorProfileManager.getProfile.execute({ profileId });
}

async function ensureSourceGroupExists(
  sourceGroupReferences: SourceGroupReferencePort,
  sourceGroupId: ProfileSourceAccessSourceGroupId,
): Promise<void> {
  const exists = await sourceGroupReferences.exists(sourceGroupId);

  if (!exists) {
    throw new SourceGroupNotFoundError(sourceGroupId);
  }
}

async function profileSourceAccessExists(
  collectorProfileManager: CollectorProfileManagerHttpService,
  profileId: ProfileId,
  sourceGroupId: ProfileSourceAccessSourceGroupId,
): Promise<boolean> {
  try {
    await collectorProfileManager.getProfileSourceAccess.execute({
      profileId,
      sourceGroupId,
    });

    return true;
  } catch (error) {
    if (error instanceof ProfileSourceAccessNotFoundError) {
      return false;
    }

    throw error;
  }
}

function toProfileSummary(profile: CollectorProfile): ProfileSummary {
  return {
    id: profile.identity.id,
    displayName: profile.identity.displayName,
    status: profile.identity.status,
    accountStage: profile.identity.accountStage,
    createdAt: profile.identity.createdAt,
    updatedAt: profile.identity.updatedAt,
    lastCheckoutAt: profile.identity.lastCheckoutAt,
    lastReleasedAt: profile.identity.lastReleasedAt,
    nextAvailableAt: profile.identity.nextAvailableAt,
    dailyUsage: profile.identity.dailyUsage,
    hasHardwareFingerprint: profile.hardwareFingerprint !== null,
    hasAuthenticationState:
      profile.authenticationState.sessionCapturedAt !== null ||
      profile.authenticationState.cookies.length > 0 ||
      profile.authenticationState.localStorage.length > 0,
    provisioningTokenStatus: profile.provisioningToken.status,
  };
}

function toProfileReadNetworkContext(
  networkContext: NetworkContext,
): ProfileReadNetworkContext {
  if (networkContext.proxy === null) {
    return {
      proxy: null,
      killswitch: networkContext.killswitch,
    };
  }

  const { credentials: _credentials, ...proxy } = networkContext.proxy;

  return {
    proxy,
    killswitch: networkContext.killswitch,
  };
}
