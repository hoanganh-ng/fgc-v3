import type { ProfileHomeFeedCollectionRunRepository } from "../ports/profile-home-feed-collection-run-repository.port";
import { loadValidatedProfileHomeFeedCollectionRunById } from "../profile-home-feed-collection-run-validation";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunId,
} from "../../domain";

export interface GetProfileHomeFeedCollectionRunInput {
  readonly runId: ProfileHomeFeedCollectionRunId;
}

export class GetProfileHomeFeedCollectionRunUseCase {
  public constructor(
    private readonly runs: ProfileHomeFeedCollectionRunRepository,
  ) {}

  public async execute(
    input: GetProfileHomeFeedCollectionRunInput,
  ): Promise<ProfileHomeFeedCollectionRun> {
    return loadValidatedProfileHomeFeedCollectionRunById(
      this.runs,
      input.runId,
    );
  }
}
