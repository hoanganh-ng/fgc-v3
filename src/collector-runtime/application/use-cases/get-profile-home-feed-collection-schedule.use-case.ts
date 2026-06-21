import { loadValidatedProfileHomeFeedCollectionScheduleByProfileId } from "../profile-home-feed-collection-schedule-validation";
import type { ProfileHomeFeedCollectionScheduleRepository } from "../ports/profile-home-feed-collection-schedule-repository.port";
import type {
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleProfileId,
} from "../../domain";

export interface GetProfileHomeFeedCollectionScheduleInput {
  readonly profileId: ProfileHomeFeedCollectionScheduleProfileId;
}

export class GetProfileHomeFeedCollectionScheduleUseCase {
  public constructor(
    private readonly schedules: ProfileHomeFeedCollectionScheduleRepository,
  ) {}

  public async execute(
    input: GetProfileHomeFeedCollectionScheduleInput,
  ): Promise<ProfileHomeFeedCollectionSchedule> {
    return loadValidatedProfileHomeFeedCollectionScheduleByProfileId(
      this.schedules,
      input.profileId,
    );
  }
}
