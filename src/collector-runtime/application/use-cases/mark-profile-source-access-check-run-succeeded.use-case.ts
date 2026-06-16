import type { Clock } from "../ports/clock.port";
import type { ProfileSourceAccessCheckRunRepository } from "../ports/profile-source-access-check-run-repository.port";
import {
  loadValidatedProfileSourceAccessCheckRunById,
  toProfileSourceAccessCheckRunIsoDateTime,
  validateProfileSourceAccessCheckRunForApplication,
} from "../profile-source-access-check-run-validation";
import { assertValidProfileSourceAccessCheckRunStatusTransition } from "../../domain";
import type { ProfileSourceAccessCheckRun } from "../../domain";

export class MarkProfileSourceAccessCheckRunSucceededUseCase {
  public constructor(
    private readonly checkRuns: ProfileSourceAccessCheckRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    checkRunId: string,
  ): Promise<ProfileSourceAccessCheckRun> {
    const checkRun = await loadValidatedProfileSourceAccessCheckRunById(
      this.checkRuns,
      checkRunId,
    );

    assertValidProfileSourceAccessCheckRunStatusTransition(
      checkRun.status,
      "SUCCEEDED",
    );

    const now = toProfileSourceAccessCheckRunIsoDateTime(this.clock.now());

    const succeeded = validateProfileSourceAccessCheckRunForApplication({
      ...checkRun,
      status: "SUCCEEDED",
      finishedAt: now,
      updatedAt: now,
    });

    await this.checkRuns.save(succeeded);

    return succeeded;
  }
}
