import type { Clock } from "../ports/clock.port";
import type { ProfileSourceAccessCheckRunRepository } from "../ports/profile-source-access-check-run-repository.port";
import {
  loadValidatedProfileSourceAccessCheckRunById,
  toProfileSourceAccessCheckRunIsoDateTime,
  validateProfileSourceAccessCheckRunForApplication,
} from "../profile-source-access-check-run-validation";
import { assertValidProfileSourceAccessCheckRunStatusTransition } from "../../domain";
import type { ProfileSourceAccessCheckRun } from "../../domain";

export interface MarkProfileSourceAccessCheckRunRunningInput {
  readonly checkRunId: string;
}

export class MarkProfileSourceAccessCheckRunRunningUseCase {
  public constructor(
    private readonly checkRuns: ProfileSourceAccessCheckRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: MarkProfileSourceAccessCheckRunRunningInput,
  ): Promise<ProfileSourceAccessCheckRun> {
    const checkRun = await loadValidatedProfileSourceAccessCheckRunById(
      this.checkRuns,
      input.checkRunId,
    );

    assertValidProfileSourceAccessCheckRunStatusTransition(
      checkRun.status,
      "RUNNING",
    );

    const now = toProfileSourceAccessCheckRunIsoDateTime(this.clock.now());

    const running = validateProfileSourceAccessCheckRunForApplication({
      ...checkRun,
      status: "RUNNING",
      startedAt: now,
      updatedAt: now,
    });

    await this.checkRuns.save(running);

    return running;
  }
}
