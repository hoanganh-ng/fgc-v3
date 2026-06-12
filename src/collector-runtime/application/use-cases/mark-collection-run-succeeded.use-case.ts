import { InvalidCollectionRunStatusTransitionError } from "../application-errors";
import {
  loadValidatedCollectionRunById,
  toCollectionRunIsoDateTime,
  validateCollectionRunForApplication,
  validateCollectionRunSummaryForApplication,
} from "../collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { CollectionRunRepository } from "../ports/collection-run-repository.port";
import {
  canTransitionCollectionRunStatus,
  type CollectionRun,
  type CollectionRunId,
  type CollectionRunSummary,
} from "../../domain";

export interface MarkCollectionRunSucceededInput {
  readonly collectionRunId: CollectionRunId;
  readonly summary?: CollectionRunSummary;
}

export class MarkCollectionRunSucceededUseCase {
  public constructor(
    private readonly collectionRuns: CollectionRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: MarkCollectionRunSucceededInput,
  ): Promise<CollectionRun> {
    const collectionRun = await loadValidatedCollectionRunById(
      this.collectionRuns,
      input.collectionRunId,
    );

    if (!canTransitionCollectionRunStatus(collectionRun.status, "SUCCEEDED")) {
      throw new InvalidCollectionRunStatusTransitionError(
        collectionRun.status,
        "SUCCEEDED",
      );
    }

    const { failureReason: _failureReason, ...runWithoutFailureReason } =
      collectionRun;
    const summary =
      input.summary === undefined
        ? undefined
        : validateCollectionRunSummaryForApplication(input.summary);
    const now = toCollectionRunIsoDateTime(this.clock.now());
    const updatedCollectionRun = validateCollectionRunForApplication({
      ...runWithoutFailureReason,
      status: "SUCCEEDED",
      ...(summary !== undefined ? { summary } : {}),
      finishedAt: now,
      updatedAt: now,
    });

    await this.collectionRuns.save(updatedCollectionRun);

    return updatedCollectionRun;
  }
}
