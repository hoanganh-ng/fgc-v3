import type { ProfileSourceAccessCheckRunRepository } from "../ports/profile-source-access-check-run-repository.port";
import { loadValidatedProfileSourceAccessCheckRunById } from "../profile-source-access-check-run-validation";
import type { ProfileSourceAccessCheckRun } from "../../domain";

export interface GetProfileSourceAccessCheckRunInput {
  readonly checkRunId: string;
}

export class GetProfileSourceAccessCheckRunUseCase {
  public constructor(
    private readonly checkRuns: ProfileSourceAccessCheckRunRepository,
  ) {}

  public async execute(
    input: GetProfileSourceAccessCheckRunInput,
  ): Promise<ProfileSourceAccessCheckRun> {
    return loadValidatedProfileSourceAccessCheckRunById(
      this.checkRuns,
      input.checkRunId,
    );
  }
}
