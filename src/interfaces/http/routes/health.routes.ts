import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(server: FastifyInstance): void {
  server.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            required: ["status"],
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["ok"] },
            },
          },
        },
      },
    },
    async () => ({
      status: "ok",
    }),
  );
}
