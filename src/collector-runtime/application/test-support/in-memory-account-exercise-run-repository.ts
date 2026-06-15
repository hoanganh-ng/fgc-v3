import type {
  AccountExerciseRun,
  AccountExerciseRunId,
  AccountExerciseRunIsoDateTime,
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

  public async claimNextQueued(
    startedAt: AccountExerciseRunIsoDateTime,
  ): Promise<AccountExerciseRun | null> {
    const accountExerciseRun = [...this.accountExerciseRuns.values()]
      .filter((candidate) => candidate.status === "QUEUED")
      .sort(compareAccountExerciseRunsByRequestedAtAsc)[0];

    if (accountExerciseRun === undefined) {
      return null;
    }

    const claimedAccountExerciseRun: AccountExerciseRun = {
      ...accountExerciseRun,
      status: "RUNNING",
      startedAt,
      updatedAt: startedAt,
    };

    this.accountExerciseRuns.set(
      claimedAccountExerciseRun.id,
      claimedAccountExerciseRun,
    );

    return claimedAccountExerciseRun;
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

function compareAccountExerciseRunsByRequestedAtAsc(
  left: AccountExerciseRun,
  right: AccountExerciseRun,
): number {
  const requestedAtComparison =
    Date.parse(left.requestedAt) - Date.parse(right.requestedAt);

  if (requestedAtComparison !== 0) {
    return requestedAtComparison;
  }

  const createdAtComparison =
    Date.parse(left.createdAt) - Date.parse(right.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return left.id.localeCompare(right.id);
}
