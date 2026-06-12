import type { Clock } from "../ports/clock.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
import { toIsoDateTime } from "../provisioning-token-policy";
import {
  loadValidatedProfileById,
  validateProfileForApplication,
} from "../profile-validation";
import { toProfileDetailDto } from "../profile-read-dtos";
import type { ProfileDetail } from "../profile-read-dtos";
import { transitionCollectorProfileAccountStage } from "../../domain";
import type { ProfileAccountStage, ProfileId } from "../../domain";

export interface UpdateProfileAccountStageInput {
  readonly profileId: ProfileId;
  readonly accountStage: ProfileAccountStage;
}

export class UpdateProfileAccountStageUseCase {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: UpdateProfileAccountStageInput,
  ): Promise<ProfileDetail> {
    const profile = await loadValidatedProfileById(
      this.profiles,
      input.profileId,
    );
    const updatedAt = toIsoDateTime(this.clock.now());
    const updatedProfile = validateProfileForApplication(
      transitionCollectorProfileAccountStage(
        profile,
        input.accountStage,
        updatedAt,
      ),
    );

    await this.profiles.save(updatedProfile);

    return toProfileDetailDto(updatedProfile);
  }
}
