import { ProfileHomeFeedCollectionRunConflictError } from "../application-errors";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunId,
  ProfileHomeFeedCollectionRunIsoDateTime,
} from "../../domain";
import type {
  ProfileHomeFeedCollectionRunListQuery,
  ProfileHomeFeedCollectionRunListResult,
  ProfileHomeFeedCollectionRunRepository,
} from "../ports/profile-home-feed-collection-run-repository.port";

export class InMemoryProfileHomeFeedCollectionRunRepository
  implements ProfileHomeFeedCollectionRunRepository
{
  private readonly runs = new Map<
    ProfileHomeFeedCollectionRunId,
    ProfileHomeFeedCollectionRun
  >();

  public async save(run: ProfileHomeFeedCollectionRun): Promise<void> {
    if (run.status === "QUEUED" || run.status === "RUNNING") {
      const conflictingRun = [...this.runs.values()].find(
        (candidate) =>
          candidate.id !== run.id &&
          candidate.profileId === run.profileId &&
          (candidate.status === "QUEUED" || candidate.status === "RUNNING"),
      );

      if (conflictingRun !== undefined) {
        throw new ProfileHomeFeedCollectionRunConflictError(run.profileId);
      }
    }

    this.runs.set(run.id, run);
  }

  public async findById(
    id: ProfileHomeFeedCollectionRunId,
  ): Promise<ProfileHomeFeedCollectionRun | null> {
    return this.runs.get(id) ?? null;
  }

  public async list(
    query: ProfileHomeFeedCollectionRunListQuery,
  ): Promise<ProfileHomeFeedCollectionRunListResult> {
    const matchingRuns = [...this.runs.values()]
      .filter((run) => query.status === undefined || run.status === query.status)
      .filter(
        (run) =>
          query.profileId === undefined || run.profileId === query.profileId,
      )
      .sort(compareProfileHomeFeedCollectionRunsByCreatedAtDesc);

    return {
      items: matchingRuns.slice(query.offset, query.offset + query.limit),
      total: matchingRuns.length,
    };
  }

  public async claimNextQueued(
    startedAt: ProfileHomeFeedCollectionRunIsoDateTime,
  ): Promise<ProfileHomeFeedCollectionRun | null> {
    const run = [...this.runs.values()]
      .filter((candidate) => candidate.status === "QUEUED")
      .sort(compareProfileHomeFeedCollectionRunsByRequestedAtAsc)[0];

    if (run === undefined) {
      return null;
    }

    const claimedRun: ProfileHomeFeedCollectionRun = {
      ...run,
      status: "RUNNING",
      startedAt,
      updatedAt: startedAt,
    };

    this.runs.set(claimedRun.id, claimedRun);

    return claimedRun;
  }
}

function compareProfileHomeFeedCollectionRunsByCreatedAtDesc(
  left: ProfileHomeFeedCollectionRun,
  right: ProfileHomeFeedCollectionRun,
): number {
  const createdAtComparison =
    Date.parse(right.createdAt) - Date.parse(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return right.id.localeCompare(left.id);
}

function compareProfileHomeFeedCollectionRunsByRequestedAtAsc(
  left: ProfileHomeFeedCollectionRun,
  right: ProfileHomeFeedCollectionRun,
): number {
  const requestedAtComparison =
    Date.parse(left.requestedAt) - Date.parse(right.requestedAt);

  if (requestedAtComparison !== 0) {
    return requestedAtComparison;
  }

  return left.id.localeCompare(right.id);
}
