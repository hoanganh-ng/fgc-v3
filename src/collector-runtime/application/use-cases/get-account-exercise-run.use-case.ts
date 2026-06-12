import { loadValidatedAccountExerciseRunById } from "../account-exercise-run-validation";
import type { AccountExerciseRunRepository } from "../ports/account-exercise-run-repository.port";
import type { AccountExerciseRun, AccountExerciseRunId } from "../../domain";

export interface GetAccountExerciseRunInput {
  readonly accountExerciseRunId: AccountExerciseRunId;
}

export class GetAccountExerciseRunUseCase {
  public constructor(
    private readonly accountExerciseRuns: AccountExerciseRunRepository,
  ) {}

  public async execute(
    input: GetAccountExerciseRunInput,
  ): Promise<AccountExerciseRun> {
    return loadValidatedAccountExerciseRunById(
      this.accountExerciseRuns,
      input.accountExerciseRunId,
    );
  }
}
