import {
  toProfileHomeFeedCollectionRunIsoDateTime,
  validateProfileHomeFeedCollectionRunForApplication,
} from "../profile-home-feed-collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { ProfileHomeFeedCollectionRunRepository } from "../ports/profile-home-feed-collection-run-repository.port";
import type { ProfileHomeFeedCollectionRun } from "../../domain";

export class ClaimNextProfileHomeFeedCollectionRunUseCase {
  public constructor(
    private readonly runs: ProfileHomeFeedCollectionRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(): Promise<ProfileHomeFeedCollectionRun | null> {
    const now = toProfileHomeFeedCollectionRunIsoDateTime(this.clock.now());
    const run = await this.runs.claimNextQueued(now);

    return run === null
      ? null
      : validateProfileHomeFeedCollectionRunForApplication(run);
  }
}
