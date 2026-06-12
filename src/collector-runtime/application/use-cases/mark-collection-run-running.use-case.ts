import { InvalidCollectionRunStatusTransitionError } from "../application-errors";
import {
  loadValidatedCollectionRunById,
  toCollectionRunIsoDateTime,
  validateCollectionRunForApplication,
} from "../collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { CollectionRunRepository } from "../ports/collection-run-repository.port";
import {
  canTransitionCollectionRunStatus,
  type CollectionRun,
  type CollectionRunId,
} from "../../domain";

export interface MarkCollectionRunRunningInput {
  readonly collectionRunId: CollectionRunId;
}

export class MarkCollectionRunRunningUseCase {
  public constructor(
    private readonly collectionRuns: CollectionRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: MarkCollectionRunRunningInput,
  ): Promise<CollectionRun> {
    const collectionRun = await loadValidatedCollectionRunById(
      this.collectionRuns,
      input.collectionRunId,
    );

    if (!canTransitionCollectionRunStatus(collectionRun.status, "RUNNING")) {
      throw new InvalidCollectionRunStatusTransitionError(
        collectionRun.status,
        "RUNNING",
      );
    }

    const now = toCollectionRunIsoDateTime(this.clock.now());
    const updatedCollectionRun = validateCollectionRunForApplication({
      ...collectionRun,
      status: "RUNNING",
      startedAt: now,
      updatedAt: now,
    });

    await this.collectionRuns.save(updatedCollectionRun);

    return updatedCollectionRun;
  }
}
