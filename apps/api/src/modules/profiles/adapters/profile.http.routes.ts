import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';

import type {
  AuthSessionState,
  BehavioralPersona,
  Lifecycle,
  NetworkIdentity,
  Routine,
} from '../domain';
import { InvalidProfileStatusError, ProfileNotFoundError } from '../profile.errors';
import type { CompleteProfileProvisioningUseCase } from '../use-cases/complete-profile-provisioning.use-case';
import type {
  CreateProfileInput,
  CreateProfileUseCase,
} from '../use-cases/create-profile.use-case';
import type { GetProfileByTokenUseCase } from '../use-cases/get-profile-by-token.use-case';

export interface ProfileHttpRoutesOptions {
  createProfileUseCase: CreateProfileUseCase;
  getProfileByTokenUseCase: GetProfileByTokenUseCase;
  completeProfileProvisioningUseCase: CompleteProfileProvisioningUseCase;
}

interface ProvisioningTokenParams {
  token: string;
}

type HttpLifecycle = Omit<Lifecycle, 'accountCreatedAt'> & {
  accountCreatedAt: string;
};

interface CreateProfileRequestBody {
  name: string;
  networkIdentity: NetworkIdentity;
  behavioralPersona: BehavioralPersona;
  routine: Routine;
  lifecycle: HttpLifecycle;
}

type CompleteProfileProvisioningRequestBody = AuthSessionState;

const errorResponseSchema = {
  type: 'object',
  required: ['error', 'message'],
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
    expectedStatus: { type: 'string' },
    actualStatus: { type: 'string' },
  },
  additionalProperties: false,
} as const;

const nullableStringSchema = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
} as const;

const proxyConfigurationSchema = {
  type: 'object',
  required: ['server', 'port', 'protocol', 'username', 'password'],
  properties: {
    server: { type: 'string', minLength: 1 },
    port: { type: 'integer', minimum: 1, maximum: 65535 },
    protocol: { type: 'string', minLength: 1 },
    username: nullableStringSchema,
    password: nullableStringSchema,
  },
  additionalProperties: false,
} as const;

const networkIdentitySchema = {
  type: 'object',
  required: ['proxy', 'networkKillSwitch'],
  properties: {
    proxy: proxyConfigurationSchema,
    networkKillSwitch: { type: 'boolean' },
  },
  additionalProperties: false,
} as const;

const viewportSchema = {
  type: 'object',
  required: ['width', 'height'],
  properties: {
    width: { type: 'integer', minimum: 1 },
    height: { type: 'integer', minimum: 1 },
  },
  additionalProperties: false,
} as const;

const hardwareFingerprintSchema = {
  type: 'object',
  required: [
    'userAgent',
    'viewport',
    'timezoneId',
    'languages',
    'hardwareConcurrency',
    'deviceMemory',
  ],
  properties: {
    userAgent: { type: 'string', minLength: 1 },
    viewport: viewportSchema,
    timezoneId: { type: 'string', minLength: 1 },
    languages: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
    hardwareConcurrency: { type: 'integer', minimum: 1 },
    deviceMemory: { type: 'number', minimum: 0 },
  },
  additionalProperties: false,
} as const;

const behavioralPersonaSchema = {
  type: 'object',
  required: ['personaType', 'scrollPattern', 'macroDelayMs', 'upwardScrollChance'],
  properties: {
    personaType: {
      type: 'string',
      enum: ['GENZ_REEL_ADDICT', 'THE_ELDER', 'STANDARD_RESEARCHER'],
    },
    scrollPattern: { type: 'string', minLength: 1 },
    macroDelayMs: {
      type: 'object',
      required: ['min', 'max'],
      properties: {
        min: { type: 'integer', minimum: 0 },
        max: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
    upwardScrollChance: { type: 'number', minimum: 0, maximum: 1 },
  },
  additionalProperties: false,
} as const;

const activeWindowSchema = {
  type: 'object',
  required: ['start', 'end'],
  properties: {
    start: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
    end: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
  },
  additionalProperties: false,
} as const;

const routineSchema = {
  type: 'object',
  required: ['chronotype', 'activeWindows', 'weekendVariance'],
  properties: {
    chronotype: {
      type: 'string',
      enum: ['NIGHT_OWL', '9_TO_5_WORKER', 'THE_RETIREE', 'ALWAYS_ONLINE'],
    },
    activeWindows: {
      type: 'array',
      items: activeWindowSchema,
    },
    weekendVariance: { type: 'boolean' },
  },
  additionalProperties: false,
} as const;

const lifecycleSchema = {
  type: 'object',
  required: ['stage', 'accountCreatedAt', 'safetyLimits'],
  properties: {
    stage: {
      type: 'string',
      enum: ['TIER_1_NEWBIE', 'TIER_2_WARMUP', 'TIER_3_MATURE', 'TIER_4_VETERAN'],
    },
    accountCreatedAt: { type: 'string', minLength: 1 },
    safetyLimits: {
      type: 'object',
      required: ['maxSessionsPerDay', 'maxDurationMinutes', 'maxActionsPerSession'],
      properties: {
        maxSessionsPerDay: { type: 'integer', minimum: 0 },
        maxDurationMinutes: { type: 'integer', minimum: 0 },
        maxActionsPerSession: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

const createProfileBodySchema = {
  type: 'object',
  required: ['name', 'networkIdentity', 'behavioralPersona', 'routine', 'lifecycle'],
  properties: {
    name: { type: 'string', minLength: 1 },
    networkIdentity: networkIdentitySchema,
    behavioralPersona: behavioralPersonaSchema,
    routine: routineSchema,
    lifecycle: lifecycleSchema,
  },
  additionalProperties: false,
} as const;

const provisioningTokenParamsSchema = {
  type: 'object',
  required: ['token'],
  properties: {
    token: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const;

const completeProvisioningBodySchema = {
  type: 'object',
  required: ['cookies', 'localStorageSnapshot'],
  properties: {
    cookies: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
      },
    },
    localStorageSnapshot: nullableStringSchema,
  },
  additionalProperties: false,
} as const;

const createProfileResponseSchema = {
  type: 'object',
  required: ['provisioningToken'],
  properties: {
    provisioningToken: { type: 'string' },
  },
  additionalProperties: false,
} as const;

const provisioningConfigResponseSchema = {
  type: 'object',
  required: ['networkIdentity', 'hardwareFingerprint'],
  properties: {
    networkIdentity: networkIdentitySchema,
    hardwareFingerprint: hardwareFingerprintSchema,
  },
  additionalProperties: false,
} as const;

const successResponseSchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string' },
  },
  additionalProperties: false,
} as const;

export const profileHttpRoutes: FastifyPluginAsync<ProfileHttpRoutesOptions> = async (
  fastify,
  options,
) => {
  fastify.post<{ Body: CreateProfileRequestBody }>(
    '/api/profiles',
    {
      schema: {
        body: createProfileBodySchema,
        response: {
          201: createProfileResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const input = toCreateProfileInput(request.body);

      if (input === null) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: 'lifecycle.accountCreatedAt must be a valid date string.',
        });
      }

      try {
        const provisioningToken = await options.createProfileUseCase.execute(input);

        return reply.code(201).send({ provisioningToken });
      } catch (error) {
        return sendProfileError(fastify, reply, error);
      }
    },
  );

  fastify.get<{ Params: ProvisioningTokenParams }>(
    '/api/profiles/provision/:token',
    {
      schema: {
        params: provisioningTokenParamsSchema,
        response: {
          200: provisioningConfigResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const profile = await options.getProfileByTokenUseCase.execute(request.params.token);

        return reply.code(200).send({
          networkIdentity: profile.networkIdentity,
          hardwareFingerprint: profile.hardwareFingerprint,
        });
      } catch (error) {
        return sendProfileError(fastify, reply, error);
      }
    },
  );

  fastify.post<{
    Params: ProvisioningTokenParams;
    Body: CompleteProfileProvisioningRequestBody;
  }>(
    '/api/profiles/provision/:token/complete',
    {
      schema: {
        params: provisioningTokenParamsSchema,
        body: completeProvisioningBodySchema,
        response: {
          200: successResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await options.completeProfileProvisioningUseCase.execute(request.params.token, request.body);

        return reply.code(200).send({
          message: 'Profile provisioning completed successfully.',
        });
      } catch (error) {
        return sendProfileError(fastify, reply, error);
      }
    },
  );
};

function toCreateProfileInput(body: CreateProfileRequestBody): CreateProfileInput | null {
  const accountCreatedAt = new Date(body.lifecycle.accountCreatedAt);

  if (Number.isNaN(accountCreatedAt.getTime())) {
    return null;
  }

  return {
    name: body.name,
    networkIdentity: body.networkIdentity,
    behavioralPersona: body.behavioralPersona,
    routine: body.routine,
    lifecycle: {
      ...body.lifecycle,
      accountCreatedAt,
    },
  };
}

function sendProfileError(
  fastify: FastifyInstance,
  reply: FastifyReply,
  error: unknown,
): FastifyReply {
  if (error instanceof ProfileNotFoundError) {
    return reply.code(404).send({
      error: error.name,
      message: error.message,
    });
  }

  if (error instanceof InvalidProfileStatusError) {
    return reply.code(409).send({
      error: error.name,
      message: error.message,
      expectedStatus: error.expectedStatus,
      actualStatus: error.actualStatus,
    });
  }

  fastify.log.error({ err: error }, 'Unhandled profile HTTP route error');

  return reply.code(500).send({
    error: 'InternalServerError',
    message: 'Unable to process profile request.',
  });
}

export default profileHttpRoutes;
