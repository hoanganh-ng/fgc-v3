import { ZodError } from "zod";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { DomainError } from "@dtpm/core";

const conflictCodes = new Set([
  "CONCURRENCY_CONFLICT",
  "INVALID_PROVISIONING_TOKEN",
  "INVALID_STATE_TRANSITION",
  "LEASE_CONFLICT",
  "NO_ELIGIBLE_PROFILE"
]);

export async function errorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (error instanceof ZodError) {
    await reply.code(400).send({
      code: "VALIDATION_ERROR",
      message: "Request payload failed validation",
      details: error.flatten()
    });
    return;
  }

  if (error instanceof DomainError) {
    const statusCode = error.code === "PROFILE_NOT_FOUND"
      ? 404
      : conflictCodes.has(error.code)
        ? 409
        : 400;

    await reply.code(statusCode).send({
      code: error.code,
      message: error.message
    });
    return;
  }

  await reply.code(500).send({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error"
  });
}
