import {
  InvalidProfileHomeFeedCollectionRunStatusTransitionError,
  ProfileHomeFeedCollectionRunNotFoundError,
} from "../application-errors";
import {
  loadValidatedProfileHomeFeedCollectionRunById,
  toProfileHomeFeedCollectionRunIsoDateTime,
  validateProfileHomeFeedCollectionRunForApplication,
  validateProfileHomeFeedCollectionRunSummaryForApplication,
} from "../profile-home-feed-collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { ProfileHomeFeedCollectionRunRepository } from "../ports/profile-home-feed-collection-run-repository.port";
import {
  canTransitionProfileHomeFeedCollectionRunStatus,
  type ProfileHomeFeedCollectionRun,
  type ProfileHomeFeedCollectionRunId,
  type ProfileHomeFeedCollectionRunSummary,
} from "../../domain";

export interface MarkProfileHomeFeedCollectionRunSucceededInput {
  readonly runId: ProfileHomeFeedCollectionRunId;
  readonly summary: ProfileHomeFeedCollectionRunSummary;
}

export class MarkProfileHomeFeedCollectionRunSucceededUseCase {
  public constructor(
    private readonly runs: ProfileHomeFeedCollectionRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: MarkProfileHomeFeedCollectionRunSucceededInput,
  ): Promise<ProfileHomeFeedCollectionRun> {
    const run = await loadValidatedProfileHomeFeedCollectionRunById(
      this.runs,
      input.runId,
    );

    if (!canTransitionProfileHomeFeedCollectionRunStatus(run.status, "SUCCEEDED")) {
      throw new InvalidProfileHomeFeedCollectionRunStatusTransitionError(
        run.status,
        "SUCCEEDED",
      );
    }

    const summary = validateProfileHomeFeedCollectionRunSummaryForApplication(
      input.summary,
    );
    const { failureReason: _failureReason, ...runWithoutFailureReason } = run;
    const now = toProfileHomeFeedCollectionRunIsoDateTime(this.clock.now());
    const succeeded = validateProfileHomeFeedCollectionRunForApplication({
      ...runWithoutFailureReason,
      status: "SUCCEEDED",
      summary,
      finishedAt: now,
      updatedAt: now,
    });

    const result = await this.runs.transitionStatus({
      runId: succeeded.id,
      expectedStatus: "RUNNING",
      nextStatus: "SUCCEEDED",
      summary,
      finishedAt: now,
      updatedAt: now,
    });

    if (result.ok) {
      return result.run;
    }

    if (result.reason === "not_found") {
      throw new ProfileHomeFeedCollectionRunNotFoundError(input.runId);
    }

    throw new InvalidProfileHomeFeedCollectionRunStatusTransitionError(
      result.currentRun.status,
      "SUCCEEDED",
    );
  }
}
