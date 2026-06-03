import type { ProfileStatus } from './domain/index.js';

export class ProfileNotFoundError extends Error {
  constructor() {
    super('Profile not found.');
    this.name = 'ProfileNotFoundError';
  }
}

export class InvalidProfileStatusError extends Error {
  constructor(
    public readonly expectedStatus: ProfileStatus,
    public readonly actualStatus: ProfileStatus,
  ) {
    super(`Invalid profile status: expected ${expectedStatus}, received ${actualStatus}.`);
    this.name = 'InvalidProfileStatusError';
  }
}
