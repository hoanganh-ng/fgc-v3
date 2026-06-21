import type {
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleProfileId,
} from "../../domain";

export interface ProfileHomeFeedCollectionScheduleListQuery {
  readonly enabled?: boolean;
  readonly limit: number;
  readonly offset: number;
}

export interface ProfileHomeFeedCollectionScheduleListResult {
  readonly items: readonly ProfileHomeFeedCollectionSchedule[];
  readonly total: number;
}

export interface ProfileHomeFeedCollectionScheduleRepository {
  save(schedule: ProfileHomeFeedCollectionSchedule): Promise<void>;
  findByProfileId(
    profileId: ProfileHomeFeedCollectionScheduleProfileId,
  ): Promise<ProfileHomeFeedCollectionSchedule | null>;
  list(
    query: ProfileHomeFeedCollectionScheduleListQuery,
  ): Promise<ProfileHomeFeedCollectionScheduleListResult>;
}
