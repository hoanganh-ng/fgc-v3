import type { FastifyInstance } from "fastify";
import type {
  CheckoutProfileInput,
  CheckoutProfileOutput,
  CreateProfileInput,
  GetProfileInput,
  GetProvisioningConfigurationInput,
  IngestProfileSessionInput,
  ListProfilesInput,
  ListProfilesOutput,
  ProfileDetail,
  ProvisioningConfiguration,
  ReleaseProfileLeaseInput,
  ReleaseProfileLeaseOutput,
  StartProfileProvisioningInput,
  StartProfileProvisioningOutput,
  UpdateProfileConfigurationInput,
} from "../../../collector-profile-manager/application";
import type {
  CollectorProfile,
  DailySafetyUsage,
  IsoDateTime,
  ProfileId,
  ProfileLease,
  ProfileStatus,
  ProvisioningTokenStatus,
} from "../../../collector-profile-manager/domain";
import {
  CheckoutProfileHttpBodySchema,
  CreateProfileHttpBodySchema,
  ListProfilesHttpQuerySchema,
  IngestProfileSessionHttpBodySchema,
  ProfileIdHttpParamsSchema,
  ProfileLeaseIdHttpParamsSchema,
  ProvisioningTokenHttpParamsSchema,
  ReleaseProfileLeaseHttpBodySchema,
  UpdateProfileConfigurationHttpBodySchema,
  checkoutProfileHttpRouteSchema,
  createProfileHttpRouteSchema,
  getProvisioningConfigurationHttpRouteSchema,
  getProfileHttpRouteSchema,
  ingestProfileSessionHttpRouteSchema,
  listProfilesHttpRouteSchema,
  parseHttpInput,
  releaseProfileLeaseHttpRouteSchema,
  startProfileProvisioningHttpRouteSchema,
  updateProfileConfigurationHttpRouteSchema,
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
  readonly startProfileProvisioning: ExecutableUseCase<
    StartProfileProvisioningInput,
    StartProfileProvisioningOutput
  >;
  readonly getProvisioningConfiguration: ExecutableUseCase<
    GetProvisioningConfigurationInput,
    ProvisioningConfiguration
  >;
  readonly ingestProfileSession: ExecutableUseCase<
    IngestProfileSessionInput,
    CollectorProfile
  >;
  readonly checkoutProfile: ExecutableUseCase<
    CheckoutProfileInput | undefined,
    CheckoutProfileOutput
  >;
  readonly releaseProfileLease: ExecutableUseCase<
    ReleaseProfileLeaseInput,
    ReleaseProfileLeaseOutput
  >;
}

export interface RegisterCollectorProfileManagerRoutesOptions {
  readonly collectorProfileManager: CollectorProfileManagerHttpService;
}

interface ProfileSummary {
  readonly id: ProfileId;
  readonly displayName: string;
  readonly status: ProfileStatus;
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
  const { collectorProfileManager } = options;

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

      return collectorProfileManager.getProvisioningConfiguration.execute({
        provisioningToken: params.token,
      });
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
      const input =
        body.profileId === undefined
          ? {}
          : ({
              profileId: body.profileId,
            } satisfies CheckoutProfileInput);

      return collectorProfileManager.checkoutProfile.execute(input);
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
}

function toProfileSummary(profile: CollectorProfile): ProfileSummary {
  return {
    id: profile.identity.id,
    displayName: profile.identity.displayName,
    status: profile.identity.status,
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
