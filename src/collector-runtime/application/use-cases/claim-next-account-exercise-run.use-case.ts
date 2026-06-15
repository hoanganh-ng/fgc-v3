import {
  toAccountExerciseRunIsoDateTime,
  validateAccountExerciseRunForApplication,
} from "../account-exercise-run-validation";
import type { Clock } from "../ports/clock.port";
import type { AccountExerciseRunRepository } from "../ports/account-exercise-run-repository.port";
import type { AccountExerciseRun } from "../../domain";

export class ClaimNextAccountExerciseRunUseCase {
  public constructor(
    private readonly accountExerciseRuns: AccountExerciseRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(): Promise<AccountExerciseRun | null> {
    const now = toAccountExerciseRunIsoDateTime(this.clock.now());
    const accountExerciseRun =
      await this.accountExerciseRuns.claimNextQueued(now);

    return accountExerciseRun === null
      ? null
      : validateAccountExerciseRunForApplication(accountExerciseRun);
  }
}
