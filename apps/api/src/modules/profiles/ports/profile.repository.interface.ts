import type { Profile } from '../domain';

export interface IProfileRepository {
  save(profile: Profile): Promise<void>;
  findByProvisioningToken(token: string): Promise<Profile | null>;
  generateId(): string;
}
