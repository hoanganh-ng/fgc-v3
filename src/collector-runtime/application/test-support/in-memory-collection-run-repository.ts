import type {
  CollectionRun,
  CollectionRunId,
  CollectionRunIsoDateTime,
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

  public async claimNextQueued(
    startedAt: CollectionRunIsoDateTime,
  ): Promise<CollectionRun | null> {
    const collectionRun = [...this.collectionRuns.values()]
      .filter((candidate) => candidate.status === "QUEUED")
      .sort(compareCollectionRunsByRequestedAtAsc)[0];

    if (collectionRun === undefined) {
      return null;
    }

    const claimedCollectionRun: CollectionRun = {
      ...collectionRun,
      status: "RUNNING",
      startedAt,
      updatedAt: startedAt,
    };

    this.collectionRuns.set(claimedCollectionRun.id, claimedCollectionRun);

    return claimedCollectionRun;
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

function compareCollectionRunsByRequestedAtAsc(
  left: CollectionRun,
  right: CollectionRun,
): number {
  const requestedAtComparison =
    Date.parse(left.requestedAt) - Date.parse(right.requestedAt);

  if (requestedAtComparison !== 0) {
    return requestedAtComparison;
  }

  const createdAtComparison =
    Date.parse(left.createdAt) - Date.parse(right.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return left.id.localeCompare(right.id);
}
