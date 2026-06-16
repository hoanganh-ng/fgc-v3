import type { Clock } from "../ports/clock.port";
import type { ProfileSourceAccessCheckRunRepository } from "../ports/profile-source-access-check-run-repository.port";
import {
  loadValidatedProfileSourceAccessCheckRunById,
  toProfileSourceAccessCheckRunIsoDateTime,
  validateProfileSourceAccessCheckRunFailureReasonForApplication,
  validateProfileSourceAccessCheckRunForApplication,
} from "../profile-source-access-check-run-validation";
import { assertValidProfileSourceAccessCheckRunStatusTransition } from "../../domain";
import type { ProfileSourceAccessCheckRun, ProfileSourceAccessCheckRunFailureReason } from "../../domain";

export interface MarkProfileSourceAccessCheckRunFailedInput {
  readonly checkRunId: string;
  readonly failureReason: ProfileSourceAccessCheckRunFailureReason;
}

export class MarkProfileSourceAccessCheckRunFailedUseCase {
  public constructor(
    private readonly checkRuns: ProfileSourceAccessCheckRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: MarkProfileSourceAccessCheckRunFailedInput,
  ): Promise<ProfileSourceAccessCheckRun> {
    const checkRun = await loadValidatedProfileSourceAccessCheckRunById(
      this.checkRuns,
      input.checkRunId,
    );

    assertValidProfileSourceAccessCheckRunStatusTransition(
      checkRun.status,
      "FAILED",
    );

    const now = toProfileSourceAccessCheckRunIsoDateTime(this.clock.now());
    const failureReason =
      validateProfileSourceAccessCheckRunFailureReasonForApplication(
        input.failureReason,
      );
    const { outcome: _outcome, ...checkRunWithoutOutcome } = checkRun;

    const failed = validateProfileSourceAccessCheckRunForApplication({
      ...checkRunWithoutOutcome,
      status: "FAILED",
      failureReason,
      finishedAt: now,
      updatedAt: now,
    });

    await this.checkRuns.save(failed);

    return failed;
  }
}
