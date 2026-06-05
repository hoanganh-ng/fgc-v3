import fastify from "fastify";
import type { FastifyInstance, FastifyServerOptions } from "fastify";
import { mapErrorToHttpResponse } from "./errors/http-error-mapper";
import {
  registerCollectorProfileManagerRoutes,
  type CollectorProfileManagerHttpService,
} from "./routes/collector-profile-manager.routes";
import { registerHealthRoutes } from "./routes/health.routes";

export interface CreateHttpServerOptions {
  readonly collectorProfileManager: CollectorProfileManagerHttpService;
  readonly logger?: FastifyServerOptions["logger"];
}

export function createHttpServer(
  options: CreateHttpServerOptions,
): FastifyInstance {
  const server = fastify({
    logger: options.logger ?? false,
  });

  server.setErrorHandler((error, _request, reply) => {
    const mappedError = mapErrorToHttpResponse(error);

    reply.code(mappedError.statusCode).send(mappedError.body);
  });

  registerHealthRoutes(server);
  registerCollectorProfileManagerRoutes(server, {
    collectorProfileManager: options.collectorProfileManager,
  });

  return server;
}
