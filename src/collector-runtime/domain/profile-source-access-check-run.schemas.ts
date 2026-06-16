import { z } from "zod";
import { PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUSES } from "./profile-source-access-check-run-status";
import { PROFILE_SOURCE_ACCESS_CHECK_RUN_TRIGGER_TYPES } from "./profile-source-access-check-run-trigger-type";

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

export const ProfileSourceAccessCheckRunIsoDateTimeSchema = z.iso.datetime({
  offset: true,
});
export const ProfileSourceAccessCheckRunIdSchema = NonEmptyStringSchema;
export const ProfileSourceAccessCheckRunStatusSchema = z.enum(
  PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUSES,
);
export const ProfileSourceAccessCheckRunTriggerTypeSchema = z.enum(
  PROFILE_SOURCE_ACCESS_CHECK_RUN_TRIGGER_TYPES,
);

/**
 * The run target freezes a credential-free HTTPS Facebook direct URL at
 * request time. Platform must be FACEBOOK; routeType must be DIRECT_GROUP_URL.
 */
export const ProfileSourceAccessCheckRunTargetSchema = z
  .object({
    platform: z.literal("FACEBOOK"),
    routeType: z.literal("DIRECT_GROUP_URL"),
    url: NonEmptyStringSchema,
  })
  .strict()
  .superRefine((target, context) => {
    let parsed: URL | undefined;
    try {
      parsed = new URL(target.url);
    } catch {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Check run target URL must be a valid URL.",
      });
      return;
    }

    if (parsed.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message:
          "Check run target URL must use the https scheme.",
      });
      return;
    }

    if (parsed.username || parsed.password) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Check run target URL must not contain credentials.",
      });
      return;
    }

    const hostname = parsed.hostname.toLowerCase();
    const isFacebook =
      hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    if (!isFacebook) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Check run target URL must be a Facebook URL.",
      });
    }
  });

/**
 * Sanitized failure reason — code and message are scrubbed before storage.
 * Raw upstream messages must never be stored here.
 */
export const ProfileSourceAccessCheckRunFailureReasonSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();

export const ProfileSourceAccessCheckRunSchema = z
  .object({
    id: ProfileSourceAccessCheckRunIdSchema,
    profileId: NonEmptyStringSchema,
    sourceGroupId: NonEmptyStringSchema,
    triggerType: ProfileSourceAccessCheckRunTriggerTypeSchema,
    status: ProfileSourceAccessCheckRunStatusSchema,
    accountStageAtRequest: NonEmptyStringSchema,
    target: ProfileSourceAccessCheckRunTargetSchema,
    failureReason: ProfileSourceAccessCheckRunFailureReasonSchema.optional(),
    requestedAt: ProfileSourceAccessCheckRunIsoDateTimeSchema,
    startedAt: ProfileSourceAccessCheckRunIsoDateTimeSchema.optional(),
    finishedAt: ProfileSourceAccessCheckRunIsoDateTimeSchema.optional(),
    createdAt: ProfileSourceAccessCheckRunIsoDateTimeSchema,
    updatedAt: ProfileSourceAccessCheckRunIsoDateTimeSchema,
  })
  .strict();
