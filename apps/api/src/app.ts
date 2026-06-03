import fastify, { type FastifyInstance } from 'fastify';

import { BasicFingerprintGenerator } from './modules/profiles/adapters/basic-fingerprint.generator.js';
import { profileHttpRoutes } from './modules/profiles/adapters/profile.http.routes.js';
import {
  ProfileSqliteRepository,
  type SqliteDatabase,
} from './modules/profiles/adapters/profile.sqlite.repository.js';
import { CompleteProfileProvisioningUseCase } from './modules/profiles/use-cases/complete-profile-provisioning.use-case.js';
import { CreateProfileUseCase } from './modules/profiles/use-cases/create-profile.use-case.js';
import { GetProfileByTokenUseCase } from './modules/profiles/use-cases/get-profile-by-token.use-case.js';

export function buildApp(database: SqliteDatabase): FastifyInstance {
  const profileRepository = new ProfileSqliteRepository(database);
  const fingerprintGenerator = new BasicFingerprintGenerator();

  const createProfileUseCase = new CreateProfileUseCase(profileRepository, fingerprintGenerator);
  const getProfileByTokenUseCase = new GetProfileByTokenUseCase(profileRepository);
  const completeProfileProvisioningUseCase = new CompleteProfileProvisioningUseCase(
    profileRepository,
  );

  const app = fastify({
    logger: true,
  });

  app.register(profileHttpRoutes, {
    createProfileUseCase,
    getProfileByTokenUseCase,
    completeProfileProvisioningUseCase,
  });

  return app;
}
