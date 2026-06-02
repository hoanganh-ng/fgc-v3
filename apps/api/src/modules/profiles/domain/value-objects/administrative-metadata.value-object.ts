import type { ProfileStatus } from '../types/profile-status.type';

export interface AdministrativeMetadata {
  id: string;
  name: string;
  provisioningToken: string | null;
  status: ProfileStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  lastActivityAt: Date | null;
}
