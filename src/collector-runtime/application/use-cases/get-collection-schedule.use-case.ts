import { loadValidatedCollectionScheduleBySourceGroupId } from "../collection-schedule-validation";
import type { CollectionScheduleRepository } from "../ports/collection-schedule-repository.port";
import type {
  CollectionSchedule,
  CollectionScheduleSourceGroupId,
} from "../../domain";

export interface GetCollectionScheduleInput {
  readonly sourceGroupId: CollectionScheduleSourceGroupId;
}

export class GetCollectionScheduleUseCase {
  public constructor(
    private readonly collectionSchedules: CollectionScheduleRepository,
  ) {}

  public async execute(
    input: GetCollectionScheduleInput,
  ): Promise<CollectionSchedule> {
    return loadValidatedCollectionScheduleBySourceGroupId(
      this.collectionSchedules,
      input.sourceGroupId,
    );
  }
}
