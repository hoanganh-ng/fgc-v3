import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  checkoutRequestSchema,
  checkoutResponseSchema,
  configureProfileResponseSchema,
  createProfileRequestSchema,
  createProfileResponseSchema,
  errorResponseSchema,
  profileConfigurationRequestSchema,
  profileListResponseSchema,
  profileReadSchema,
  provisioningConfigurationResponseSchema,
  provisioningTokenResponseSchema,
  releaseLeaseRequestSchema,
  releaseLeaseResponseSchema,
  sessionIngestionRequestSchema,
  sessionIngestionResponseSchema
} from "@dtpm/contracts";
import { InvalidProvisioningTokenError } from "@dtpm/core";
import type { ProfileService } from "@dtpm/core";
import { firstHeaderValue, requireAdminApiKey } from "./auth.js";
import { toJsonSchema } from "./json-schema.js";
import { toProfileRead } from "./mappers.js";

const profileParamsSchema = z.object({
  id: z.string().uuid()
});

const leaseParamsSchema = z.object({
  leaseId: z.string().uuid()
});

const standardResponses = {
  400: toJsonSchema(errorResponseSchema, "ErrorResponse"),
  401: toJsonSchema(errorResponseSchema, "UnauthorizedErrorResponse"),
  404: toJsonSchema(errorResponseSchema, "NotFoundErrorResponse"),
  409: toJsonSchema(errorResponseSchema, "ConflictErrorResponse"),
  500: toJsonSchema(errorResponseSchema, "ServerErrorResponse")
};

export async function registerProfileRoutes(
  app: FastifyInstance,
  profileService: ProfileService,
  adminApiKey: string
): Promise<void> {
  const adminOnly = async (request: FastifyRequest, reply: FastifyReply) =>
    requireAdminApiKey(request, reply, adminApiKey);

  app.get("/health", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" }
          },
          required: ["status"]
        }
      }
    }
  }, async () => ({ status: "ok" }));

  app.get("/admin/profiles", {
    preHandler: adminOnly,
    schema: {
      response: {
        200: toJsonSchema(profileListResponseSchema, "ProfileListResponse"),
        ...standardResponses
      }
    }
  }, async () => {
    const profiles = await profileService.listProfiles();
    return {
      profiles: profiles.map(toProfileRead)
    };
  });

  app.post("/admin/profiles", {
    preHandler: adminOnly,
    schema: {
      body: toJsonSchema(createProfileRequestSchema, "CreateProfileRequest"),
      response: {
        201: toJsonSchema(createProfileResponseSchema, "CreateProfileResponse"),
        ...standardResponses
      }
    }
  }, async (request, reply) => {
    const body = createProfileRequestSchema.parse(request.body);
    const profile = await profileService.createProfile(body);
    await reply.code(201).send({
      profile: toProfileRead(profile)
    });
  });

  app.get("/admin/profiles/:id", {
    preHandler: adminOnly,
    schema: {
      params: toJsonSchema(profileParamsSchema, "ProfileParams"),
      response: {
        200: toJsonSchema(profileReadSchema, "ProfileRead"),
        ...standardResponses
      }
    }
  }, async (request) => {
    const params = profileParamsSchema.parse(request.params);
    return toProfileRead(await profileService.getProfile(params.id));
  });

  app.put("/admin/profiles/:id/configuration", {
    preHandler: adminOnly,
    schema: {
      params: toJsonSchema(profileParamsSchema, "ConfigureProfileParams"),
      body: toJsonSchema(profileConfigurationRequestSchema, "ProfileConfigurationRequest"),
      response: {
        200: toJsonSchema(configureProfileResponseSchema, "ConfigureProfileResponse"),
        ...standardResponses
      }
    }
  }, async (request) => {
    const params = profileParamsSchema.parse(request.params);
    const body = profileConfigurationRequestSchema.parse(request.body);
    const result = await profileService.configureProfile(params.id, body);
    return {
      profile: toProfileRead(result.profile),
      provisioningToken: result.provisioningToken === null ? null : {
        token: result.provisioningToken.token,
        expiresAt: result.provisioningToken.expiresAt.toISOString()
      }
    };
  });

  app.post("/admin/profiles/:id/provisioning-token", {
    preHandler: adminOnly,
    schema: {
      params: toJsonSchema(profileParamsSchema, "ProvisioningTokenParams"),
      response: {
        200: toJsonSchema(provisioningTokenResponseSchema, "ProvisioningTokenResponse"),
        ...standardResponses
      }
    }
  }, async (request) => {
    const params = profileParamsSchema.parse(request.params);
    const token = await profileService.issueProvisioningToken(params.id);
    return {
      profileId: params.id,
      token: token.token,
      expiresAt: token.expiresAt.toISOString()
    };
  });

  app.post("/admin/checkout", {
    preHandler: adminOnly,
    schema: {
      body: toJsonSchema(checkoutRequestSchema, "CheckoutRequest"),
      response: {
        200: toJsonSchema(checkoutResponseSchema, "CheckoutResponse"),
        ...standardResponses
      }
    }
  }, async (request) => {
    const body = checkoutRequestSchema.parse(request.body);
    const checkout = await profileService.checkout(body);
    return {
      leaseId: checkout.leaseId,
      profile: toProfileRead(checkout.profile),
      expiresAt: checkout.expiresAt.toISOString()
    };
  });

  app.post("/admin/leases/:leaseId/release", {
    preHandler: adminOnly,
    schema: {
      params: toJsonSchema(leaseParamsSchema, "ReleaseLeaseParams"),
      body: toJsonSchema(releaseLeaseRequestSchema, "ReleaseLeaseRequest"),
      response: {
        200: toJsonSchema(releaseLeaseResponseSchema, "ReleaseLeaseResponse"),
        ...standardResponses
      }
    }
  }, async (request) => {
    const params = leaseParamsSchema.parse(request.params);
    const body = releaseLeaseRequestSchema.parse(request.body);
    const profile = await profileService.releaseLease(params.leaseId, body);
    return {
      profile: toProfileRead(profile)
    };
  });

  app.get("/provisioning/configuration", {
    schema: {
      response: {
        200: toJsonSchema(provisioningConfigurationResponseSchema, "ProvisioningConfigurationResponse"),
        ...standardResponses
      }
    }
  }, async (request) => {
    const token = readProvisioningToken(request);
    const config = await profileService.getProvisioningConfig(token);
    return {
      profileId: config.profileId,
      hardwareFingerprint: config.hardwareFingerprint,
      networkContext: config.networkContext,
      expiresAt: config.expiresAt.toISOString()
    };
  });

  app.post("/provisioning/session", {
    schema: {
      body: toJsonSchema(sessionIngestionRequestSchema, "SessionIngestionRequest"),
      response: {
        200: toJsonSchema(sessionIngestionResponseSchema, "SessionIngestionResponse"),
        ...standardResponses
      }
    }
  }, async (request) => {
    const token = readProvisioningToken(request);
    const body = sessionIngestionRequestSchema.parse(request.body);
    const profile = await profileService.ingestSession(token, body.authenticationState);
    return {
      profile: toProfileRead(profile)
    };
  });
}

function readProvisioningToken(request: FastifyRequest): string {
  const token = firstHeaderValue(request.headers["x-provisioning-token"]);

  if (token === undefined || token.trim() === "") {
    throw new InvalidProvisioningTokenError("Provisioning token header is required");
  }

  return token;
}
