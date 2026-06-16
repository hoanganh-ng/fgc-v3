import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunId,
} from "../../domain";
import type {
  ProfileSourceAccessCheckRunListQuery,
  ProfileSourceAccessCheckRunListResult,
  ProfileSourceAccessCheckRunRepository,
} from "../ports/profile-source-access-check-run-repository.port";

export class InMemoryProfileSourceAccessCheckRunRepository
  implements ProfileSourceAccessCheckRunRepository
{
  private readonly checkRuns = new Map<
    ProfileSourceAccessCheckRunId,
    ProfileSourceAccessCheckRun
  >();

  public async save(run: ProfileSourceAccessCheckRun): Promise<void> {
    this.checkRuns.set(run.id, run);
  }

  public async findById(
    id: ProfileSourceAccessCheckRunId,
  ): Promise<ProfileSourceAccessCheckRun | null> {
    return this.checkRuns.get(id) ?? null;
  }

  public async findByProfileAndSourceGroup(
    profileId: string,
    sourceGroupId: string,
  ): Promise<readonly ProfileSourceAccessCheckRun[]> {
    return [...this.checkRuns.values()]
      .filter(
        (run) =>
          run.profileId === profileId && run.sourceGroupId === sourceGroupId,
      )
      .sort(compareProfileSourceAccessCheckRunsByCreatedAtDesc);
  }

  public async list(
    query: ProfileSourceAccessCheckRunListQuery,
  ): Promise<ProfileSourceAccessCheckRunListResult> {
    const matchingRuns = [...this.checkRuns.values()]
      .filter(
        (run) => query.status === undefined || run.status === query.status,
      )
      .filter(
        (run) =>
          query.profileId === undefined || run.profileId === query.profileId,
      )
      .filter(
        (run) =>
          query.sourceGroupId === undefined ||
          run.sourceGroupId === query.sourceGroupId,
      )
      .sort(compareProfileSourceAccessCheckRunsByCreatedAtDesc);

    return {
      items: matchingRuns.slice(query.offset, query.offset + query.limit),
      total: matchingRuns.length,
    };
  }
}

function compareProfileSourceAccessCheckRunsByCreatedAtDesc(
  left: ProfileSourceAccessCheckRun,
  right: ProfileSourceAccessCheckRun,
): number {
  const createdAtComparison = Date.parse(right.createdAt) - Date.parse(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return right.id.localeCompare(left.id);
}
