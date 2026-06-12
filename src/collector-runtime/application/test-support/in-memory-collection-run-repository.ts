import type {
  CollectionRun,
  CollectionRunId,
} from "../../domain";
import type {
  CollectionRunListQuery,
  CollectionRunListResult,
  CollectionRunRepository,
} from "../ports/collection-run-repository.port";

export class InMemoryCollectionRunRepository
  implements CollectionRunRepository
{
  private readonly collectionRuns = new Map<CollectionRunId, CollectionRun>();

  public async save(collectionRun: CollectionRun): Promise<void> {
    this.collectionRuns.set(collectionRun.id, collectionRun);
  }

  public async findById(
    id: CollectionRunId,
  ): Promise<CollectionRun | null> {
    return this.collectionRuns.get(id) ?? null;
  }

  public async list(
    query: CollectionRunListQuery,
  ): Promise<CollectionRunListResult> {
    const matchingCollectionRuns = [...this.collectionRuns.values()]
      .filter(
        (collectionRun) =>
          query.status === undefined || collectionRun.status === query.status,
      )
      .filter(
        (collectionRun) =>
          query.sourceGroupId === undefined ||
          collectionRun.sourceGroupId === query.sourceGroupId,
      )
      .sort(compareCollectionRunsByCreatedAtDesc);

    return {
      items: matchingCollectionRuns.slice(
        query.offset,
        query.offset + query.limit,
      ),
      total: matchingCollectionRuns.length,
    };
  }
}

function compareCollectionRunsByCreatedAtDesc(
  left: CollectionRun,
  right: CollectionRun,
): number {
  const createdAtComparison = Date.parse(right.createdAt) - Date.parse(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return right.id.localeCompare(left.id);
}
