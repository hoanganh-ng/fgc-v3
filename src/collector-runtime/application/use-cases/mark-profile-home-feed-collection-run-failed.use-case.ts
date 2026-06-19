import { InvalidProfileHomeFeedCollectionRunStatusTransitionError } from "../application-errors";
import {
  loadValidatedProfileHomeFeedCollectionRunById,
  toProfileHomeFeedCollectionRunIsoDateTime,
  validateProfileHomeFeedCollectionRunFailureReasonForApplication,
  validateProfileHomeFeedCollectionRunForApplication,
  validateProfileHomeFeedCollectionRunSummaryForApplication,
} from "../profile-home-feed-collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { ProfileHomeFeedCollectionRunRepository } from "../ports/profile-home-feed-collection-run-repository.port";
import {
  canTransitionProfileHomeFeedCollectionRunStatus,
  type ProfileHomeFeedCollectionRun,
  type ProfileHomeFeedCollectionRunFailureReason,
  type ProfileHomeFeedCollectionRunId,
  type ProfileHomeFeedCollectionRunSummary,
} from "../../domain";

export interface MarkProfileHomeFeedCollectionRunFailedInput {
  readonly runId: ProfileHomeFeedCollectionRunId;
  readonly failureReason: ProfileHomeFeedCollectionRunFailureReason;
  readonly summary?: ProfileHomeFeedCollectionRunSummary;
}

export class MarkProfileHomeFeedCollectionRunFailedUseCase {
  public constructor(
    private readonly runs: ProfileHomeFeedCollectionRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: MarkProfileHomeFeedCollectionRunFailedInput,
  ): Promise<ProfileHomeFeedCollectionRun> {
    const run = await loadValidatedProfileHomeFeedCollectionRunById(
      this.runs,
      input.runId,
    );

    if (!canTransitionProfileHomeFeedCollectionRunStatus(run.status, "FAILED")) {
      throw new InvalidProfileHomeFeedCollectionRunStatusTransitionError(
        run.status,
        "FAILED",
      );
    }

    const failureReason =
      validateProfileHomeFeedCollectionRunFailureReasonForApplication(
        input.failureReason,
      );
    const summary =
      input.summary === undefined
        ? undefined
        : validateProfileHomeFeedCollectionRunSummaryForApplication(
            input.summary,
          );
    const now = toProfileHomeFeedCollectionRunIsoDateTime(this.clock.now());
    const failed = validateProfileHomeFeedCollectionRunForApplication({
      ...run,
      status: "FAILED",
      ...(summary !== undefined ? { summary } : {}),
      failureReason,
      finishedAt: now,
      updatedAt: now,
    });

    await this.runs.save(failed);

    return failed;
  }
}
