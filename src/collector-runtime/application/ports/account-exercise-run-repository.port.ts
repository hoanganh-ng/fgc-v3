import type {
  AccountExerciseRun,
  AccountExerciseRunId,
  AccountExerciseRunStatus,
} from "../../domain";

export interface AccountExerciseRunListQuery {
  readonly status?: AccountExerciseRunStatus;
  readonly profileId?: string;
  readonly limit: number;
  readonly offset: number;
}

export interface AccountExerciseRunListResult {
  readonly items: readonly AccountExerciseRun[];
  readonly total?: number;
}

export interface AccountExerciseRunRepository {
  save(accountExerciseRun: AccountExerciseRun): Promise<void>;
  findById(id: AccountExerciseRunId): Promise<AccountExerciseRun | null>;
  list(
    query: AccountExerciseRunListQuery,
  ): Promise<AccountExerciseRunListResult>;
}
