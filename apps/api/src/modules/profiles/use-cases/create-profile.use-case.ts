import { randomBytes } from 'node:crypto';

import type {
  BehavioralPersona,
  ContentPreferences,
  Lifecycle,
  NetworkIdentity,
  Profile,
  Routine,
} from '../domain';
import type { IFingerprintGenerator } from '../ports/fingerprint-generator.interface';
import type { IProfileRepository } from '../ports/profile.repository.interface';

export interface CreateProfileInput {
  name: string;
  networkIdentity: NetworkIdentity;
  behavioralPersona: BehavioralPersona;
  contentPreferences: ContentPreferences;
  routine: Routine;
  lifecycle: Lifecycle;
}

export class CreateProfileUseCase {
  constructor(
    private readonly profileRepository: IProfileRepository,
    private readonly fingerprintGenerator: IFingerprintGenerator,
  ) {}

  async execute(input: CreateProfileInput): Promise<string> {
    const id = this.profileRepository.generateId();
    const provisioningToken = randomBytes(32).toString('hex');
    const hardwareFingerprint = await this.fingerprintGenerator.generate(input.networkIdentity);
    const now = new Date();

    const profile: Profile = {
      administrativeMetadata: {
        id,
        name: input.name,
        provisioningToken,
        status: 'PENDING_LOGIN',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
        lastActivityAt: null,
      },
      networkIdentity: input.networkIdentity,
      hardwareFingerprint,
      authSessionState: {
        cookies: [],
        localStorageSnapshot: null,
      },
      behavioralPersona: input.behavioralPersona,
      contentPreferences: input.contentPreferences,
      routine: input.routine,
      lifecycle: input.lifecycle,
    };

    await this.profileRepository.save(profile);

    return provisioningToken;
  }
}
