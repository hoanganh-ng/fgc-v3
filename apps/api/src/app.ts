import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import type { ProfileService } from "@dtpm/core";
import { errorHandler } from "./http/errors.js";
import { registerProfileRoutes } from "./http/profile-routes.js";

export interface BuildAppOptions {
  profileService: ProfileService;
  adminApiKey: string;
  corsOrigin: string;
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: options.logger ?? false
  });

  app.setErrorHandler(errorHandler);

  await app.register(cors, {
    origin: options.corsOrigin,
    credentials: false
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Digital Twin Profile Manager API",
        version: "0.1.0"
      }
    }
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });

  await registerProfileRoutes(app, options.profileService, options.adminApiKey);

  return app;
}
