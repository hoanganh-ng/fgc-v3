import { loadValidatedSourceGroupById } from "../content-validation";
import type { SourceGroupRepository } from "../ports/source-group-repository.port";
import { withDefaultSourceGroupEntryRoutes } from "../../domain";
import type { SourceGroup, SourceGroupId } from "../../domain";

export interface GetSourceGroupInput {
  readonly sourceGroupId: SourceGroupId;
}

export class GetSourceGroupUseCase {
  public constructor(private readonly sourceGroups: SourceGroupRepository) {}

  public async execute(input: GetSourceGroupInput): Promise<SourceGroup> {
    return withDefaultSourceGroupEntryRoutes(
      await loadValidatedSourceGroupById(
        this.sourceGroups,
        input.sourceGroupId,
      ),
    );
  }
}
