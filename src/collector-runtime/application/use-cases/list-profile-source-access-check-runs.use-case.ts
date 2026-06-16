import type {
  ProfileSourceAccessCheckRunListQuery,
  ProfileSourceAccessCheckRunListResult,
  ProfileSourceAccessCheckRunRepository,
} from "../ports/profile-source-access-check-run-repository.port";
import { validateProfileSourceAccessCheckRunForApplication } from "../profile-source-access-check-run-validation";
import type { ProfileSourceAccessCheckRun, ProfileSourceAccessCheckRunStatus } from "../../domain";

export interface ListProfileSourceAccessCheckRunsInput {
  readonly status?: ProfileSourceAccessCheckRunStatus;
  readonly profileId?: string;
  readonly sourceGroupId?: string;
  readonly limit: number;
  readonly offset: number;
}

export interface ListProfileSourceAccessCheckRunsOutput {
  readonly items: readonly ProfileSourceAccessCheckRun[];
  readonly page: {
    readonly limit: number;
    readonly offset: number;
    readonly total: number;
  };
}

export class ListProfileSourceAccessCheckRunsUseCase {
  public constructor(
    private readonly checkRuns: ProfileSourceAccessCheckRunRepository,
  ) {}

  public async execute(
    input: ListProfileSourceAccessCheckRunsInput,
  ): Promise<ListProfileSourceAccessCheckRunsOutput> {
    const { items, total } = await this.checkRuns.list(input);

    return {
      items: items.map(validateProfileSourceAccessCheckRunForApplication),
      page: {
        limit: input.limit,
        offset: input.offset,
        total,
      },
    };
  }
}
