import type { Clock } from "../ports/clock.port";
import type { ProfileSourceAccessCheckRunRepository } from "../ports/profile-source-access-check-run-repository.port";
import {
  toProfileSourceAccessCheckRunIsoDateTime,
  validateProfileSourceAccessCheckRunForApplication,
} from "../profile-source-access-check-run-validation";
import type { ProfileSourceAccessCheckRun } from "../../domain";

export class ClaimNextProfileSourceAccessCheckRunUseCase {
  public constructor(
    private readonly checkRuns: ProfileSourceAccessCheckRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(): Promise<ProfileSourceAccessCheckRun | null> {
    const now = toProfileSourceAccessCheckRunIsoDateTime(this.clock.now());
    const checkRun = await this.checkRuns.claimNextQueued(now);

    return checkRun === null
      ? null
      : validateProfileSourceAccessCheckRunForApplication(checkRun);
  }
}
