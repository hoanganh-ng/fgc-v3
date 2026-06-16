import type { Clock } from "../ports/clock.port";
import type { ProfileSourceAccessCheckRunRepository } from "../ports/profile-source-access-check-run-repository.port";
import {
  loadValidatedProfileSourceAccessCheckRunById,
  toProfileSourceAccessCheckRunIsoDateTime,
  validateProfileSourceAccessCheckRunForApplication,
} from "../profile-source-access-check-run-validation";
import { assertValidProfileSourceAccessCheckRunStatusTransition } from "../../domain";
import type { ProfileSourceAccessCheckRun } from "../../domain";

export interface CancelProfileSourceAccessCheckRunInput {
  readonly checkRunId: string;
}

export class CancelProfileSourceAccessCheckRunUseCase {
  public constructor(
    private readonly checkRuns: ProfileSourceAccessCheckRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: CancelProfileSourceAccessCheckRunInput,
  ): Promise<ProfileSourceAccessCheckRun> {
    const checkRun = await loadValidatedProfileSourceAccessCheckRunById(
      this.checkRuns,
      input.checkRunId,
    );

    assertValidProfileSourceAccessCheckRunStatusTransition(
      checkRun.status,
      "CANCELED",
    );

    const now = toProfileSourceAccessCheckRunIsoDateTime(this.clock.now());

    const canceled = validateProfileSourceAccessCheckRunForApplication({
      ...checkRun,
      status: "CANCELED",
      finishedAt: now,
      updatedAt: now,
    });

    await this.checkRuns.save(canceled);

    return canceled;
  }
}
