import type {
  AccountExerciseRun,
  AccountExerciseRunId,
} from "../../domain";
import type {
  AccountExerciseRunListQuery,
  AccountExerciseRunListResult,
  AccountExerciseRunRepository,
} from "../ports/account-exercise-run-repository.port";

export class InMemoryAccountExerciseRunRepository
  implements AccountExerciseRunRepository
{
  private readonly accountExerciseRuns = new Map<
    AccountExerciseRunId,
    AccountExerciseRun
  >();

  public async save(accountExerciseRun: AccountExerciseRun): Promise<void> {
    this.accountExerciseRuns.set(accountExerciseRun.id, accountExerciseRun);
  }

  public async findById(
    id: AccountExerciseRunId,
  ): Promise<AccountExerciseRun | null> {
    return this.accountExerciseRuns.get(id) ?? null;
  }

  public async list(
    query: AccountExerciseRunListQuery,
  ): Promise<AccountExerciseRunListResult> {
    const matchingRuns = [...this.accountExerciseRuns.values()]
      .filter(
        (run) => query.status === undefined || run.status === query.status,
      )
      .filter(
        (run) =>
          query.profileId === undefined || run.profileId === query.profileId,
      )
      .sort(compareAccountExerciseRunsByCreatedAtDesc);

    return {
      items: matchingRuns.slice(query.offset, query.offset + query.limit),
      total: matchingRuns.length,
    };
  }
}

function compareAccountExerciseRunsByCreatedAtDesc(
  left: AccountExerciseRun,
  right: AccountExerciseRun,
): number {
  const createdAtComparison = Date.parse(right.createdAt) - Date.parse(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return right.id.localeCompare(left.id);
}
