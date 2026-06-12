import {
  toAccountExerciseRunIsoDateTime,
  validateAccountExerciseRunActionBudgetForApplication,
  validateAccountExerciseRunForApplication,
} from "../account-exercise-run-validation";
import type { Clock } from "../ports/clock.port";
import type { AccountExerciseRunRepository } from "../ports/account-exercise-run-repository.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type {
  AccountExerciseRun,
  AccountExerciseRunActionBudget,
} from "../../domain";

export interface RequestAccountExerciseRunInput {
  readonly profileId: string;
  readonly stageAtStart: string;
  readonly maxDurationMs: number;
  readonly maxScrolls: number;
  readonly minDwellMs?: number;
}

export class RequestAccountExerciseRunUseCase {
  public constructor(
    private readonly accountExerciseRuns: AccountExerciseRunRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: RequestAccountExerciseRunInput,
  ): Promise<AccountExerciseRun> {
    const actionBudget = validateAccountExerciseRunActionBudgetForApplication(
      toActionBudget(input),
    );
    const now = toAccountExerciseRunIsoDateTime(this.clock.now());
    const accountExerciseRun = validateAccountExerciseRunForApplication({
      id: await this.ids.generateId(),
      profileId: input.profileId,
      exerciseType: "AMBIENT_ACCOUNT",
      status: "QUEUED",
      stageAtStart: input.stageAtStart,
      actionBudget,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await this.accountExerciseRuns.save(accountExerciseRun);

    return accountExerciseRun;
  }
}

function toActionBudget(
  input: RequestAccountExerciseRunInput,
): AccountExerciseRunActionBudget {
  return {
    maxDurationMs: input.maxDurationMs,
    maxScrolls: input.maxScrolls,
    ...(input.minDwellMs !== undefined ? { minDwellMs: input.minDwellMs } : {}),
  };
}
