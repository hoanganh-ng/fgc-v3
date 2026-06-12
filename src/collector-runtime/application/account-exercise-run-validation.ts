import {
  AccountExerciseRunNotFoundError,
  AccountExerciseRunValidationError,
} from "./application-errors";
import type { AccountExerciseRunRepository } from "./ports/account-exercise-run-repository.port";
import {
  validateAccountExerciseRun,
  validateAccountExerciseRunActionBudget,
  validateAccountExerciseRunFailureReason,
  validateAccountExerciseRunSafeSummary,
} from "../domain";
import type {
  AccountExerciseRun,
  AccountExerciseRunActionBudget,
  AccountExerciseRunFailureReason,
  AccountExerciseRunId,
  AccountExerciseRunIsoDateTime,
  AccountExerciseRunSafeSummary,
} from "../domain";

export function toAccountExerciseRunIsoDateTime(
  date: Date,
): AccountExerciseRunIsoDateTime {
  return date.toISOString();
}

export async function loadValidatedAccountExerciseRunById(
  repository: AccountExerciseRunRepository,
  accountExerciseRunId: AccountExerciseRunId,
): Promise<AccountExerciseRun> {
  const accountExerciseRun = await repository.findById(accountExerciseRunId);

  if (accountExerciseRun === null) {
    throw new AccountExerciseRunNotFoundError(accountExerciseRunId);
  }

  return validateAccountExerciseRunForApplication(accountExerciseRun);
}

export function validateAccountExerciseRunForApplication(
  accountExerciseRun: AccountExerciseRun,
): AccountExerciseRun {
  const result = validateAccountExerciseRun(accountExerciseRun);

  if (!result.valid) {
    throw new AccountExerciseRunValidationError(result.issues);
  }

  return result.value;
}

export function validateAccountExerciseRunActionBudgetForApplication(
  actionBudget: AccountExerciseRunActionBudget,
): AccountExerciseRunActionBudget {
  const result = validateAccountExerciseRunActionBudget(actionBudget);

  if (!result.valid) {
    throw new AccountExerciseRunValidationError(result.issues);
  }

  return result.value;
}

export function validateAccountExerciseRunSafeSummaryForApplication(
  safeSummary: AccountExerciseRunSafeSummary,
): AccountExerciseRunSafeSummary {
  const result = validateAccountExerciseRunSafeSummary(safeSummary);

  if (!result.valid) {
    throw new AccountExerciseRunValidationError(result.issues);
  }

  return result.value;
}

export function validateAccountExerciseRunFailureReasonForApplication(
  failureReason: AccountExerciseRunFailureReason,
): AccountExerciseRunFailureReason {
  const result = validateAccountExerciseRunFailureReason(failureReason);

  if (!result.valid) {
    throw new AccountExerciseRunValidationError(result.issues);
  }

  return result.value;
}
