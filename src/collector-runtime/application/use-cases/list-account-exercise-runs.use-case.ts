import type {
  AccountExerciseRunListResult,
  AccountExerciseRunRepository,
} from "../ports/account-exercise-run-repository.port";
import type { AccountExerciseRunStatus } from "../../domain";

export const DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT = 50;
export const MAX_ACCOUNT_EXERCISE_RUN_LIST_LIMIT = 100;

export interface ListAccountExerciseRunsInput {
  readonly status?: AccountExerciseRunStatus;
  readonly profileId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListAccountExerciseRunsOutput {
  readonly items: AccountExerciseRunListResult["items"];
  readonly page: {
    readonly limit: number;
    readonly offset: number;
    readonly total?: number;
  };
}

export class ListAccountExerciseRunsUseCase {
  public constructor(
    private readonly accountExerciseRuns: AccountExerciseRunRepository,
  ) {}

  public async execute(
    input: ListAccountExerciseRunsInput = {},
  ): Promise<ListAccountExerciseRunsOutput> {
    const limit = normalizeLimit(input.limit);
    const offset = normalizeOffset(input.offset);
    const result = await this.accountExerciseRuns.list({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
      limit,
      offset,
    });

    return {
      items: result.items,
      page: {
        limit,
        offset,
        ...(result.total !== undefined ? { total: result.total } : {}),
      },
    };
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (
    limit === undefined ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_ACCOUNT_EXERCISE_RUN_LIST_LIMIT
  ) {
    return DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT;
  }

  return limit;
}

function normalizeOffset(offset: number | undefined): number {
  if (offset === undefined || !Number.isInteger(offset) || offset < 0) {
    return 0;
  }

  return offset;
}
