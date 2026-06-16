import type {
  ProfileReferencePort,
  ProfileReferenceResult,
} from "../application/ports/profile-reference.port";
import type { ProfileManagerHttpClient } from "./profile-manager-http-client";

export class ProfileManagerProfileReferenceAdapter
  implements ProfileReferencePort
{
  public constructor(
    private readonly profileManager: ProfileManagerHttpClient,
  ) {}

  public async getProfileAccountStage(
    profileId: string,
  ): Promise<ProfileReferenceResult> {
    return this.profileManager.getSafeProfileAccountStage(profileId);
  }
}
