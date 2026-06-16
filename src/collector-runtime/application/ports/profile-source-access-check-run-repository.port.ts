import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunId,
  ProfileSourceAccessCheckRunStatus,
} from "../../domain";

export interface ProfileSourceAccessCheckRunListQuery {
  readonly status?: ProfileSourceAccessCheckRunStatus;
  readonly profileId?: string;
  readonly sourceGroupId?: string;
  readonly limit: number;
  readonly offset: number;
}

export interface ProfileSourceAccessCheckRunListResult {
  readonly items: readonly ProfileSourceAccessCheckRun[];
  readonly total?: number;
}

export interface ProfileSourceAccessCheckRunRepository {
  findById(
    id: ProfileSourceAccessCheckRunId,
  ): Promise<ProfileSourceAccessCheckRun | null>;

  findByProfileAndSourceGroup(
    profileId: string,
    sourceGroupId: string,
  ): Promise<readonly ProfileSourceAccessCheckRun[]>;

  save(run: ProfileSourceAccessCheckRun): Promise<void>;

  list(
    query: ProfileSourceAccessCheckRunListQuery,
  ): Promise<ProfileSourceAccessCheckRunListResult>;
}
