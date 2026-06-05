import { loadValidatedProfileById } from "../profile-validation";
import { toProfileDetailDto } from "../profile-read-dtos";
import type { ProfileDetail } from "../profile-read-dtos";
import type { ProfileRepository } from "../ports/profile-repository.port";
import type { ProfileId } from "../../domain";

export interface GetProfileInput {
  readonly profileId: ProfileId;
}

export class GetProfileUseCase {
  public constructor(private readonly profiles: ProfileRepository) {}

  public async execute(input: GetProfileInput): Promise<ProfileDetail> {
    const profile = await loadValidatedProfileById(
      this.profiles,
      input.profileId,
    );

    return toProfileDetailDto(profile);
  }
}
