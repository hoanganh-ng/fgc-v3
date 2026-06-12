import { InvalidAccountExerciseRunStatusTransitionError } from "../application-errors";
import {
  loadValidatedAccountExerciseRunById,
  toAccountExerciseRunIsoDateTime,
  validateAccountExerciseRunForApplication,
} from "../account-exercise-run-validation";
import type { Clock } from "../ports/clock.port";
import type { AccountExerciseRunRepository } from "../ports/account-exercise-run-repository.port";
import {
  canTransitionAccountExerciseRunStatus,
  type AccountExerciseRun,
  type AccountExerciseRunId,
} from "../../domain";

export interface MarkAccountExerciseRunRunningInput {
  readonly accountExerciseRunId: AccountExerciseRunId;
  readonly leaseId?: string;
}

export class MarkAccountExerciseRunRunningUseCase {
  public constructor(
    private readonly accountExerciseRuns: AccountExerciseRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: MarkAccountExerciseRunRunningInput,
  ): Promise<AccountExerciseRun> {
    const accountExerciseRun = await loadValidatedAccountExerciseRunById(
      this.accountExerciseRuns,
      input.accountExerciseRunId,
    );

    if (
      !canTransitionAccountExerciseRunStatus(
        accountExerciseRun.status,
        "RUNNING",
      )
    ) {
      throw new InvalidAccountExerciseRunStatusTransitionError(
        accountExerciseRun.status,
        "RUNNING",
      );
    }

    const now = toAccountExerciseRunIsoDateTime(this.clock.now());
    const updatedAccountExerciseRun = validateAccountExerciseRunForApplication({
      ...accountExerciseRun,
      status: "RUNNING",
      ...(input.leaseId !== undefined ? { leaseId: input.leaseId } : {}),
      startedAt: now,
      updatedAt: now,
    });

    await this.accountExerciseRuns.save(updatedAccountExerciseRun);

    return updatedAccountExerciseRun;
  }
}
