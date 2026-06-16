import type { ProfileSourceAccessCheckRunRepository } from "../ports/profile-source-access-check-run-repository.port";
import { loadValidatedProfileSourceAccessCheckRunById } from "../profile-source-access-check-run-validation";
import type { ProfileSourceAccessCheckRun } from "../../domain";

export class GetProfileSourceAccessCheckRunUseCase {
  public constructor(
    private readonly checkRuns: ProfileSourceAccessCheckRunRepository,
  ) {}

  public async execute(
    checkRunId: string,
  ): Promise<ProfileSourceAccessCheckRun> {
    return loadValidatedProfileSourceAccessCheckRunById(
      this.checkRuns,
      checkRunId,
    );
  }
}
