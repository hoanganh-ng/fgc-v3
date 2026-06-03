import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  ADMIN_API_KEY: z.string().min(16),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  PROVISIONING_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).default(30),
  CHECKOUT_LEASE_TTL_MINUTES: z.coerce.number().int().min(1).default(30)
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
