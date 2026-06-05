import { ProfileAlreadyExistsError } from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { ProfileRepository } from "../ports/profile-repository.port";
import { toIsoDateTime } from "../provisioning-token-policy";
import { validateProfileForApplication } from "../profile-validation";
import { createPendingCollectorProfile } from "../../domain";
import type { CollectorProfile, ProfileId } from "../../domain";

export interface CreateProfileInput {
  readonly id: ProfileId;
  readonly displayName: string;
}

export class CreateProfileUseCase {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(input: CreateProfileInput): Promise<CollectorProfile> {
    const existingProfile = await this.profiles.findById(input.id);

    if (existingProfile !== null) {
      throw new ProfileAlreadyExistsError("id", input.id);
    }

    if (await this.profiles.existsByDisplayName(input.displayName)) {
      throw new ProfileAlreadyExistsError("displayName", input.displayName);
    }

    const now = toIsoDateTime(this.clock.now());
    const profile = createPendingCollectorProfile({
      id: input.id,
      displayName: input.displayName,
      createdAt: now,
    });
    const validProfile = validateProfileForApplication(profile);

    await this.profiles.save(validProfile);

    return validProfile;
  }
}
