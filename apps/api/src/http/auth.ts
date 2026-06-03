import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireAdminApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
  expectedApiKey: string
): Promise<void> {
  const apiKey = firstHeaderValue(request.headers["x-admin-api-key"]);

  if (apiKey !== expectedApiKey) {
    await reply.code(401).send({
      code: "ADMIN_AUTH_REQUIRED",
      message: "A valid admin API key is required"
    });
  }
}

export function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
