import { ProfileService } from "@dtpm/core";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./infra/persistence/database.js";
import { KyselyProfileRepository } from "./infra/persistence/profile-repository.js";
import { CryptoTokenGenerator } from "./infra/security/crypto-token-generator.js";
import { SystemClock } from "./infra/system-clock.js";
import { UuidGenerator } from "./infra/uuid-generator.js";

const config = loadConfig();
const db = createDatabase(config.DATABASE_URL);
const profileService = new ProfileService({
  repository: new KyselyProfileRepository(db),
  clock: new SystemClock(),
  ids: new UuidGenerator(),
  tokens: new CryptoTokenGenerator(),
  provisioningTokenTtlMinutes: config.PROVISIONING_TOKEN_TTL_MINUTES,
  checkoutLeaseTtlMinutes: config.CHECKOUT_LEASE_TTL_MINUTES
});

const app = await buildApp({
  profileService,
  adminApiKey: config.ADMIN_API_KEY,
  corsOrigin: config.CORS_ORIGIN,
  logger: config.NODE_ENV !== "test"
});

const shutdown = async () => {
  await app.close();
  await db.destroy();
};

process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

await app.listen({
  host: config.HOST,
  port: config.PORT
});
