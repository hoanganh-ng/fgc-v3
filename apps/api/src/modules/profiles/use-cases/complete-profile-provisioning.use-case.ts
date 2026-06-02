import type { AuthSessionState, Profile } from '../domain';
import { InvalidProfileStatusError, ProfileNotFoundError } from '../profile.errors';
import type { IProfileRepository } from '../ports/profile.repository.interface';

export class CompleteProfileProvisioningUseCase {
  constructor(private readonly profileRepository: IProfileRepository) {}

  async execute(token: string, authSessionState: AuthSessionState): Promise<void> {
    const profile = await this.profileRepository.findByProvisioningToken(token);

    if (profile === null) {
      throw new ProfileNotFoundError();
    }

    if (profile.administrativeMetadata.status !== 'PENDING_LOGIN') {
      throw new InvalidProfileStatusError('PENDING_LOGIN', profile.administrativeMetadata.status);
    }

    const updatedProfile: Profile = {
      ...profile,
      administrativeMetadata: {
        ...profile.administrativeMetadata,
        provisioningToken: null,
        status: 'READY',
        updatedAt: new Date(),
      },
      authSessionState,
    };

    await this.profileRepository.save(updatedProfile);
  }
}
