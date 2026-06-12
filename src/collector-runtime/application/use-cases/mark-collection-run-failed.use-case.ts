import { InvalidCollectionRunStatusTransitionError } from "../application-errors";
import {
  loadValidatedCollectionRunById,
  toCollectionRunIsoDateTime,
  validateCollectionRunFailureReasonForApplication,
  validateCollectionRunForApplication,
  validateCollectionRunSummaryForApplication,
} from "../collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { CollectionRunRepository } from "../ports/collection-run-repository.port";
import {
  canTransitionCollectionRunStatus,
  type CollectionRun,
  type CollectionRunFailureReason,
  type CollectionRunId,
  type CollectionRunSummary,
} from "../../domain";

export interface MarkCollectionRunFailedInput {
  readonly collectionRunId: CollectionRunId;
  readonly failureReason: CollectionRunFailureReason;
  readonly summary?: CollectionRunSummary;
}

export class MarkCollectionRunFailedUseCase {
  public constructor(
    private readonly collectionRuns: CollectionRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: MarkCollectionRunFailedInput,
  ): Promise<CollectionRun> {
    const collectionRun = await loadValidatedCollectionRunById(
      this.collectionRuns,
      input.collectionRunId,
    );

    if (!canTransitionCollectionRunStatus(collectionRun.status, "FAILED")) {
      throw new InvalidCollectionRunStatusTransitionError(
        collectionRun.status,
        "FAILED",
      );
    }

    const failureReason = validateCollectionRunFailureReasonForApplication(
      input.failureReason,
    );
    const summary =
      input.summary === undefined
        ? undefined
        : validateCollectionRunSummaryForApplication(input.summary);
    const now = toCollectionRunIsoDateTime(this.clock.now());
    const updatedCollectionRun = validateCollectionRunForApplication({
      ...collectionRun,
      status: "FAILED",
      ...(summary !== undefined ? { summary } : {}),
      failureReason,
      finishedAt: now,
      updatedAt: now,
    });

    await this.collectionRuns.save(updatedCollectionRun);

    return updatedCollectionRun;
  }
}
