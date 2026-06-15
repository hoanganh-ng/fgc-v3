import {
  AccountExerciseRunLeaseConflictError,
  InvalidAccountExerciseRunStatusTransitionError,
} from "../application-errors";
import {
  loadValidatedAccountExerciseRunById,
  toAccountExerciseRunIsoDateTime,
  validateAccountExerciseRunForApplication,
} from "../account-exercise-run-validation";
import type { Clock } from "../ports/clock.port";
import type { AccountExerciseRunRepository } from "../ports/account-exercise-run-repository.port";
import type {
  AccountExerciseRun,
  AccountExerciseRunId,
} from "../../domain";

export interface AttachAccountExerciseRunLeaseInput {
  readonly accountExerciseRunId: AccountExerciseRunId;
  readonly leaseId: string;
}

export class AttachAccountExerciseRunLeaseUseCase {
  public constructor(
    private readonly accountExerciseRuns: AccountExerciseRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: AttachAccountExerciseRunLeaseInput,
  ): Promise<AccountExerciseRun> {
    const accountExerciseRun = await loadValidatedAccountExerciseRunById(
      this.accountExerciseRuns,
      input.accountExerciseRunId,
    );

    if (accountExerciseRun.status !== "RUNNING") {
      throw new InvalidAccountExerciseRunStatusTransitionError(
        accountExerciseRun.status,
        "RUNNING",
      );
    }

    if (accountExerciseRun.leaseId === input.leaseId) {
      return accountExerciseRun;
    }

    if (accountExerciseRun.leaseId !== undefined) {
      throw new AccountExerciseRunLeaseConflictError(accountExerciseRun.id);
    }

    const now = toAccountExerciseRunIsoDateTime(this.clock.now());
    const updatedAccountExerciseRun = validateAccountExerciseRunForApplication({
      ...accountExerciseRun,
      leaseId: input.leaseId,
      updatedAt: now,
    });

    await this.accountExerciseRuns.save(updatedAccountExerciseRun);

    return updatedAccountExerciseRun;
  }
}
