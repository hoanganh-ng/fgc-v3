import {
  attachProvisioningToken,
  checkoutProfile,
  configureProfile,
  createProfile,
  getProvisioningConfiguration,
  ingestAuthenticationState,
  releaseProfileLease
} from "../domain/profile.js";
import { DomainError, NoEligibleProfileError, ProfileNotFoundError } from "../domain/errors.js";
import type {
  AuthenticationState,
  CheckoutLease,
  NetworkContext,
  HardwareFingerprint,
  ProfileAggregate,
  ProfileConfigurationInput,
  ProvisioningTokenIssue
} from "../domain/types.js";
import type { Clock, IdGenerator, ProfileRepository, TokenGenerator } from "./ports.js";

export interface ProfileServiceDependencies {
  repository: ProfileRepository;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
  provisioningTokenTtlMinutes: number;
  checkoutLeaseTtlMinutes: number;
}

export class ProfileService {
  constructor(private readonly dependencies: ProfileServiceDependencies) {}

  async createProfile(input: { displayName: string; externalRef?: string | undefined }): Promise<ProfileAggregate> {
    const now = this.dependencies.clock.now();
    const profile = createProfile({
      id: this.dependencies.ids.newId(),
      displayName: input.displayName,
      ...(input.externalRef === undefined ? {} : { externalRef: input.externalRef }),
      now
    });

    await this.dependencies.repository.insert(profile);
    return profile;
  }

  async listProfiles(): Promise<ProfileAggregate[]> {
    return this.dependencies.repository.list();
  }

  async getProfile(id: string): Promise<ProfileAggregate> {
    const profile = await this.dependencies.repository.findById(id);

    if (profile === null) {
      throw new ProfileNotFoundError(id);
    }

    return profile;
  }

  async configureProfile(
    id: string,
    configuration: ProfileConfigurationInput
  ): Promise<{ profile: ProfileAggregate; provisioningToken: ProvisioningTokenIssue | null }> {
    const existing = await this.getProfile(id);
    const now = this.dependencies.clock.now();
    let updated = configureProfile(existing, configuration, now);
    let provisioningToken: ProvisioningTokenIssue | null = null;

    if (existing.status === "PENDING_CONFIG") {
      const token = await this.dependencies.tokens.generateProvisioningToken();
      const expiresAt = addMinutes(now, this.dependencies.provisioningTokenTtlMinutes);
      updated = attachProvisioningToken(updated, token.tokenHash, expiresAt, now);
      provisioningToken = {
        token: token.rawToken,
        expiresAt
      };
    }

    await this.dependencies.repository.update(updated, existing.version);
    return { profile: updated, provisioningToken };
  }

  async issueProvisioningToken(id: string): Promise<ProvisioningTokenIssue> {
    const existing = await this.getProfile(id);
    const now = this.dependencies.clock.now();
    const token = await this.dependencies.tokens.generateProvisioningToken();
    const expiresAt = addMinutes(now, this.dependencies.provisioningTokenTtlMinutes);
    const updated = attachProvisioningToken(existing, token.tokenHash, expiresAt, now);

    await this.dependencies.repository.update(updated, existing.version);

    return {
      token: token.rawToken,
      expiresAt
    };
  }

  async getProvisioningConfig(rawToken: string): Promise<{
    profileId: string;
    hardwareFingerprint: HardwareFingerprint;
    networkContext: NetworkContext;
    expiresAt: Date;
  }> {
    const tokenHash = await this.dependencies.tokens.hashProvisioningToken(rawToken);
    const profile = await this.dependencies.repository.findByProvisioningTokenHash(tokenHash);

    if (profile === null) {
      throw new NoEligibleProfileError("Provisioning token did not match any pending profile");
    }

    return getProvisioningConfiguration(profile, tokenHash, this.dependencies.clock.now());
  }

  async ingestSession(rawToken: string, authenticationState: Omit<AuthenticationState, "capturedAt">): Promise<ProfileAggregate> {
    const tokenHash = await this.dependencies.tokens.hashProvisioningToken(rawToken);
    const profile = await this.dependencies.repository.findByProvisioningTokenHash(tokenHash);

    if (profile === null) {
      throw new NoEligibleProfileError("Provisioning token did not match any pending profile");
    }

    const now = this.dependencies.clock.now();
    const updated = ingestAuthenticationState(profile, tokenHash, { ...authenticationState, capturedAt: now }, now);
    await this.dependencies.repository.update(updated, profile.version);
    return updated;
  }

  async checkout(input: {
    profileId?: string | undefined;
    requestedBy?: string | undefined;
    leaseTtlMinutes?: number | undefined;
  }): Promise<CheckoutLease> {
    const now = this.dependencies.clock.now();
    const leaseTtlMinutes = input.leaseTtlMinutes ?? this.dependencies.checkoutLeaseTtlMinutes;
    const candidates = input.profileId === undefined
      ? await this.dependencies.repository.findCheckoutCandidates(now, 25)
      : [await this.getProfile(input.profileId)];
    let lastError: DomainError | null = null;

    for (const profile of candidates) {
      try {
        const lease = checkoutProfile(profile, {
          leaseId: this.dependencies.ids.newId(),
          ...(input.requestedBy === undefined ? {} : { requestedBy: input.requestedBy }),
          leaseTtlMinutes,
          now
        });

        await this.dependencies.repository.update(lease.profile, profile.version);
        return lease;
      } catch (error) {
        if (error instanceof DomainError) {
          lastError = error;
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new NoEligibleProfileError();
  }

  async releaseLease(leaseId: string, input: {
    sessionDurationMinutes: number;
    macroActionsPerformed: number;
  }): Promise<ProfileAggregate> {
    const profiles = await this.dependencies.repository.list();
    const profile = profiles.find((candidate) => candidate.activeLease?.id === leaseId);

    if (profile === undefined) {
      throw new NoEligibleProfileError(`Lease ${leaseId} was not found`);
    }

    const now = this.dependencies.clock.now();
    const updated = releaseProfileLease(
      profile,
      leaseId,
      input.sessionDurationMinutes,
      input.macroActionsPerformed,
      now
    );

    await this.dependencies.repository.update(updated, profile.version);
    return updated;
  }
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
