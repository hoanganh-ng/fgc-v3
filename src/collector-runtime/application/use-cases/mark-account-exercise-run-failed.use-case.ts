import { InvalidAccountExerciseRunStatusTransitionError } from "../application-errors";
import {
  loadValidatedAccountExerciseRunById,
  toAccountExerciseRunIsoDateTime,
  validateAccountExerciseRunFailureReasonForApplication,
  validateAccountExerciseRunForApplication,
  validateAccountExerciseRunSafeSummaryForApplication,
} from "../account-exercise-run-validation";
import type { Clock } from "../ports/clock.port";
import type { AccountExerciseRunRepository } from "../ports/account-exercise-run-repository.port";
import {
  canTransitionAccountExerciseRunStatus,
  type AccountExerciseRun,
  type AccountExerciseRunFailureReason,
  type AccountExerciseRunId,
  type AccountExerciseRunSafeSummary,
} from "../../domain";

export interface MarkAccountExerciseRunFailedInput {
  readonly accountExerciseRunId: AccountExerciseRunId;
  readonly failureReason: AccountExerciseRunFailureReason;
  readonly safeSummary?: AccountExerciseRunSafeSummary;
}

export class MarkAccountExerciseRunFailedUseCase {
  public constructor(
    private readonly accountExerciseRuns: AccountExerciseRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: MarkAccountExerciseRunFailedInput,
  ): Promise<AccountExerciseRun> {
    const accountExerciseRun = await loadValidatedAccountExerciseRunById(
      this.accountExerciseRuns,
      input.accountExerciseRunId,
    );

    if (
      !canTransitionAccountExerciseRunStatus(accountExerciseRun.status, "FAILED")
    ) {
      throw new InvalidAccountExerciseRunStatusTransitionError(
        accountExerciseRun.status,
        "FAILED",
      );
    }

    const failureReason = validateAccountExerciseRunFailureReasonForApplication(
      input.failureReason,
    );
    const safeSummary =
      input.safeSummary === undefined
        ? undefined
        : validateAccountExerciseRunSafeSummaryForApplication(input.safeSummary);
    const now = toAccountExerciseRunIsoDateTime(this.clock.now());
    const updatedAccountExerciseRun = validateAccountExerciseRunForApplication({
      ...accountExerciseRun,
      status: "FAILED",
      ...(safeSummary !== undefined ? { safeSummary } : {}),
      failureReason,
      finishedAt: now,
      updatedAt: now,
    });

    await this.accountExerciseRuns.save(updatedAccountExerciseRun);

    return updatedAccountExerciseRun;
  }
}
