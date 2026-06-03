import type { ProfileAggregate } from "../domain/types.js";

export interface ProfileRepository {
  insert(profile: ProfileAggregate): Promise<void>;
  update(profile: ProfileAggregate, expectedVersion: number): Promise<void>;
  findById(id: string): Promise<ProfileAggregate | null>;
  findByProvisioningTokenHash(tokenHash: string): Promise<ProfileAggregate | null>;
  findCheckoutCandidates(now: Date, limit: number): Promise<ProfileAggregate[]>;
  list(): Promise<ProfileAggregate[]>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  newId(): string;
}

export interface TokenGenerator {
  generateProvisioningToken(): Promise<{
    rawToken: string;
    tokenHash: string;
  }>;
  hashProvisioningToken(rawToken: string): Promise<string>;
}
