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

export interface CancelAccountExerciseRunInput {
  readonly accountExerciseRunId: AccountExerciseRunId;
}

export class CancelAccountExerciseRunUseCase {
  public constructor(
    private readonly accountExerciseRuns: AccountExerciseRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: CancelAccountExerciseRunInput,
  ): Promise<AccountExerciseRun> {
    const accountExerciseRun = await loadValidatedAccountExerciseRunById(
      this.accountExerciseRuns,
      input.accountExerciseRunId,
    );

    if (
      !canTransitionAccountExerciseRunStatus(
        accountExerciseRun.status,
        "CANCELED",
      )
    ) {
      throw new InvalidAccountExerciseRunStatusTransitionError(
        accountExerciseRun.status,
        "CANCELED",
      );
    }

    const now = toAccountExerciseRunIsoDateTime(this.clock.now());
    const updatedAccountExerciseRun = validateAccountExerciseRunForApplication({
      ...accountExerciseRun,
      status: "CANCELED",
      finishedAt: now,
      updatedAt: now,
    });

    await this.accountExerciseRuns.save(updatedAccountExerciseRun);

    return updatedAccountExerciseRun;
  }
}
