import type { Profile } from '../domain/index.js';
import { InvalidProfileStatusError, ProfileNotFoundError } from '../profile.errors.js';
import type { IProfileRepository } from '../ports/profile.repository.interface.js';

export class GetProfileByTokenUseCase {
  constructor(private readonly profileRepository: IProfileRepository) {}

  async execute(token: string): Promise<Profile> {
    const profile = await this.profileRepository.findByProvisioningToken(token);

    if (profile === null) {
      throw new ProfileNotFoundError();
    }

    if (profile.administrativeMetadata.status !== 'PENDING_LOGIN') {
      throw new InvalidProfileStatusError('PENDING_LOGIN', profile.administrativeMetadata.status);
    }

    return profile;
  }
}
