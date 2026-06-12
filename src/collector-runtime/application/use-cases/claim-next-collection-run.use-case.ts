import {
  toCollectionRunIsoDateTime,
  validateCollectionRunForApplication,
} from "../collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { CollectionRunRepository } from "../ports/collection-run-repository.port";
import type { CollectionRun } from "../../domain";

export class ClaimNextCollectionRunUseCase {
  public constructor(
    private readonly collectionRuns: CollectionRunRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(): Promise<CollectionRun | null> {
    const now = toCollectionRunIsoDateTime(this.clock.now());
    const collectionRun = await this.collectionRuns.claimNextQueued(now);

    if (collectionRun === null) {
      return null;
    }

    return validateCollectionRunForApplication(collectionRun);
  }
}
