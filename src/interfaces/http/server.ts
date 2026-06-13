import fastify from "fastify";
import type { FastifyInstance, FastifyServerOptions } from "fastify";
import type { SourceGroupReferencePort } from "../../collector-profile-manager/application";
import { mapErrorToHttpResponse } from "./errors/http-error-mapper";
import {
  registerCollectorProfileManagerRoutes,
  type CollectorProfileManagerHttpService,
} from "./routes/collector-profile-manager.routes";
import {
  registerCollectorRuntimeRoutes,
  type CollectorRuntimeHttpService,
} from "./routes/collector-runtime.routes";
import {
  registerContentManagerRoutes,
  type ContentManagerHttpService,
} from "./routes/content-manager.routes";
import { registerHealthRoutes } from "./routes/health.routes";

export interface CreateHttpServerOptions {
  readonly collectorProfileManager: CollectorProfileManagerHttpService;
  readonly sourceGroupReferences: SourceGroupReferencePort;
  readonly collectorRuntime: CollectorRuntimeHttpService;
  readonly contentManager: ContentManagerHttpService;
  readonly logger?: FastifyServerOptions["logger"];
}

export function createHttpServer(
  options: CreateHttpServerOptions,
): FastifyInstance {
  const server = fastify({
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
    logger: options.logger ?? false,
  });

  server.setErrorHandler((error, _request, reply) => {
    const mappedError = mapErrorToHttpResponse(error);

    reply.code(mappedError.statusCode).send(mappedError.body);
  });

  registerHealthRoutes(server);
  registerCollectorProfileManagerRoutes(server, {
    collectorProfileManager: options.collectorProfileManager,
    sourceGroupReferences: options.sourceGroupReferences,
  });
  registerCollectorRuntimeRoutes(server, {
    collectorRuntime: options.collectorRuntime,
  });
  registerContentManagerRoutes(server, {
    contentManager: options.contentManager,
  });

  return server;
}
