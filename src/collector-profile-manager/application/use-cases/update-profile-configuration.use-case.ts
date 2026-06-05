import { InvalidApplicationOperationError } from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
import { toIsoDateTime } from "../provisioning-token-policy";
import {
  loadValidatedProfileById,
  validateProfileForApplication,
} from "../profile-validation";
import { assignHardwareFingerprint } from "../../domain";
import type {
  BehavioralPersona,
  CollectorProfile,
  ContentAffinities,
  HardwareFingerprint,
  NetworkContext,
  ProfileId,
  SafetyThresholds,
  TemporalRoutine,
} from "../../domain";

export interface UpdateProfileConfigurationInput {
  readonly profileId: ProfileId;
  readonly networkContext?: NetworkContext;
  readonly hardwareFingerprint?: HardwareFingerprint;
  readonly behavioralPersona?: BehavioralPersona;
  readonly temporalRoutine?: TemporalRoutine;
  readonly safetyThresholds?: SafetyThresholds;
  readonly contentAffinities?: ContentAffinities;
}

export class UpdateProfileConfigurationUseCase {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: UpdateProfileConfigurationInput,
  ): Promise<CollectorProfile> {
    const profile = await loadValidatedProfileById(
      this.profiles,
      input.profileId,
    );
    const updatedAt = toIsoDateTime(this.clock.now());
    let updatedProfile = profile;
    let changed = false;

    if (input.networkContext !== undefined) {
      updatedProfile = {
        ...updatedProfile,
        networkContext: input.networkContext,
      };
      changed = true;
    }

    if (input.hardwareFingerprint !== undefined) {
      if (updatedProfile.hardwareFingerprint !== null) {
        throw new InvalidApplicationOperationError(
          "Hardware fingerprint cannot be overwritten once assigned.",
        );
      }

      updatedProfile = assignHardwareFingerprint(
        updatedProfile,
        input.hardwareFingerprint,
        updatedAt,
      );
      changed = true;
    }

    if (input.behavioralPersona !== undefined) {
      updatedProfile = {
        ...updatedProfile,
        behavioralPersona: input.behavioralPersona,
      };
      changed = true;
    }

    if (input.temporalRoutine !== undefined) {
      updatedProfile = {
        ...updatedProfile,
        temporalRoutine: input.temporalRoutine,
      };
      changed = true;
    }

    if (input.safetyThresholds !== undefined) {
      updatedProfile = {
        ...updatedProfile,
        safetyThresholds: input.safetyThresholds,
      };
      changed = true;
    }

    if (input.contentAffinities !== undefined) {
      updatedProfile = {
        ...updatedProfile,
        contentAffinities: input.contentAffinities,
      };
      changed = true;
    }

    if (changed) {
      updatedProfile = {
        ...updatedProfile,
        identity: {
          ...updatedProfile.identity,
          updatedAt,
        },
      };
    }

    const validProfile = validateProfileForApplication(updatedProfile);

    await this.profiles.save(validProfile);

    return validProfile;
  }
}
