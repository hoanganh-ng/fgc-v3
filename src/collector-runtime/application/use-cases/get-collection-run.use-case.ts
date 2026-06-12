import {
  loadValidatedCollectionRunById,
} from "../collection-run-validation";
import type { CollectionRunRepository } from "../ports/collection-run-repository.port";
import type { CollectionRun, CollectionRunId } from "../../domain";

export interface GetCollectionRunInput {
  readonly collectionRunId: CollectionRunId;
}

export class GetCollectionRunUseCase {
  public constructor(private readonly collectionRuns: CollectionRunRepository) {}

  public async execute(input: GetCollectionRunInput): Promise<CollectionRun> {
    return loadValidatedCollectionRunById(
      this.collectionRuns,
      input.collectionRunId,
    );
  }
}
