import { z } from "zod";

const ApiBaseUrlSchema = z
  .string()
  .default("")
  .transform((value) => value.trim())
  .refine(isValidApiBaseUrl, {
    message:
      "VITE_API_BASE_URL must be empty, an absolute HTTP(S) URL, or an absolute path.",
  });

const EnvSchema = z
  .object({
    VITE_API_BASE_URL: ApiBaseUrlSchema,
  })
  .strip();

export const env = EnvSchema.parse(import.meta.env);

function isValidApiBaseUrl(value: string): boolean {
  if (value === "") {
    return true;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
