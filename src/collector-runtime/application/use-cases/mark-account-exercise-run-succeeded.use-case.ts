import { InvalidAccountExerciseRunStatusTransitionError } from "../application-errors";
import {
  loadValidatedAccountExerciseRunById,
  toAccountExerciseRunIsoDateTime,
  validateAccountExerciseRunForApplication,
  validateAccountExerciseRunSafeSummaryForApplication,
} from "../account-exercise-run-validation";
import type { Clock } from "../ports/clock.port";
import type { AccountExerciseRunRepository } from "../ports/account-exercise-run-repository.port";
import {
  canTransitionAccountExerciseRunStatus,
  type AccountExerciseRun,
  type AccountExerciseRunId,
  type AccountExerciseRunSafeSummary,
} from "../../domain";

export interface MarkAccountExerciseRunSucceededInput {
  readonly accountExerciseRunId: AccountExerciseRunId;
  readonly safeSummary: AccountExerciseRunSafeSummary;
}

export class MarkAccountExerciseRunSucceededUseCase {
  public constructor(
    private readonly accountExerciseRuns: AccountExerciseRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: MarkAccountExerciseRunSucceededInput,
  ): Promise<AccountExerciseRun> {
    const accountExerciseRun = await loadValidatedAccountExerciseRunById(
      this.accountExerciseRuns,
      input.accountExerciseRunId,
    );

    if (
      !canTransitionAccountExerciseRunStatus(
        accountExerciseRun.status,
        "SUCCEEDED",
      )
    ) {
      throw new InvalidAccountExerciseRunStatusTransitionError(
        accountExerciseRun.status,
        "SUCCEEDED",
      );
    }

    const { failureReason: _failureReason, ...runWithoutFailureReason } =
      accountExerciseRun;
    const safeSummary = validateAccountExerciseRunSafeSummaryForApplication(
      input.safeSummary,
    );
    const now = toAccountExerciseRunIsoDateTime(this.clock.now());
    const updatedAccountExerciseRun = validateAccountExerciseRunForApplication({
      ...runWithoutFailureReason,
      status: "SUCCEEDED",
      safeSummary,
      finishedAt: now,
      updatedAt: now,
    });

    await this.accountExerciseRuns.save(updatedAccountExerciseRun);

    return updatedAccountExerciseRun;
  }
}
