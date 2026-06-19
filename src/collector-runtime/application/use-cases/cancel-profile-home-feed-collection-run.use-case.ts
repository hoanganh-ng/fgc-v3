import { InvalidProfileHomeFeedCollectionRunStatusTransitionError } from "../application-errors";
import {
  loadValidatedProfileHomeFeedCollectionRunById,
  toProfileHomeFeedCollectionRunIsoDateTime,
  validateProfileHomeFeedCollectionRunForApplication,
} from "../profile-home-feed-collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { ProfileHomeFeedCollectionRunRepository } from "../ports/profile-home-feed-collection-run-repository.port";
import {
  canTransitionProfileHomeFeedCollectionRunStatus,
  type ProfileHomeFeedCollectionRun,
  type ProfileHomeFeedCollectionRunId,
} from "../../domain";

export interface CancelProfileHomeFeedCollectionRunInput {
  readonly runId: ProfileHomeFeedCollectionRunId;
}

export class CancelProfileHomeFeedCollectionRunUseCase {
  public constructor(
    private readonly runs: ProfileHomeFeedCollectionRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: CancelProfileHomeFeedCollectionRunInput,
  ): Promise<ProfileHomeFeedCollectionRun> {
    const run = await loadValidatedProfileHomeFeedCollectionRunById(
      this.runs,
      input.runId,
    );

    if (!canTransitionProfileHomeFeedCollectionRunStatus(run.status, "CANCELED")) {
      throw new InvalidProfileHomeFeedCollectionRunStatusTransitionError(
        run.status,
        "CANCELED",
      );
    }

    const now = toProfileHomeFeedCollectionRunIsoDateTime(this.clock.now());
    const canceled = validateProfileHomeFeedCollectionRunForApplication({
      ...run,
      status: "CANCELED",
      finishedAt: now,
      updatedAt: now,
    });

    await this.runs.save(canceled);

    return canceled;
  }
}
