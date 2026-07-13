import {
  InvalidProfileHomeFeedCollectionRunStatusTransitionError,
  ProfileHomeFeedCollectionRunNotFoundError,
} from "../application-errors";
import {
  loadValidatedProfileHomeFeedCollectionRunById,
  toProfileHomeFeedCollectionRunIsoDateTime,
  validateProfileHomeFeedCollectionRunFailureReasonForApplication,
  validateProfileHomeFeedCollectionRunForApplication,
  validateProfileHomeFeedCollectionRunSummaryForApplication,
  validateProfileHomeFeedDiagnosticSummaryForApplication,
} from "../profile-home-feed-collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { ProfileHomeFeedCollectionRunRepository } from "../ports/profile-home-feed-collection-run-repository.port";
import {
  canTransitionProfileHomeFeedCollectionRunStatus,
  type ProfileHomeFeedCollectionRun,
  type ProfileHomeFeedCollectionRunFailureReason,
  type ProfileHomeFeedCollectionRunId,
  type ProfileHomeFeedCollectionRunSummary,
  type ProfileHomeFeedDiagnosticSummary,
} from "../../domain";

export interface MarkProfileHomeFeedCollectionRunFailedInput {
  readonly runId: ProfileHomeFeedCollectionRunId;
  readonly failureReason: ProfileHomeFeedCollectionRunFailureReason;
  readonly summary?: ProfileHomeFeedCollectionRunSummary;
  readonly diagnostics?: ProfileHomeFeedDiagnosticSummary;
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
    const diagnostics =
      input.diagnostics === undefined
        ? undefined
        : validateProfileHomeFeedDiagnosticSummaryForApplication(
            input.diagnostics,
          );
    const now = toProfileHomeFeedCollectionRunIsoDateTime(this.clock.now());
    const failed = validateProfileHomeFeedCollectionRunForApplication({
      ...run,
      status: "FAILED",
      ...(summary !== undefined ? { summary } : {}),
      ...(diagnostics !== undefined ? { diagnostics } : {}),
      failureReason,
      finishedAt: now,
      updatedAt: now,
    });

    const result = await this.runs.transitionStatus({
      runId: failed.id,
      expectedStatus: "RUNNING",
      nextStatus: "FAILED",
      failureReason,
      ...(summary !== undefined ? { summary } : {}),
      ...(diagnostics !== undefined ? { diagnostics } : {}),
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
      "FAILED",
    );
  }
}
