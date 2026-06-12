import {
  loadValidatedSourceGroupById,
  toIsoDateTime,
  validateSourceGroupForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { SourceGroupRepository } from "../ports/source-group-repository.port";
import { withDefaultSourceGroupEntryRoutes } from "../../domain";
import type {
  SourceGroup,
  SourceGroupId,
  SourceGroupStatus,
} from "../../domain";

export interface UpdateSourceGroupStatusInput {
  readonly sourceGroupId: SourceGroupId;
  readonly status: SourceGroupStatus;
}

export class UpdateSourceGroupStatusUseCase {
  public constructor(
    private readonly sourceGroups: SourceGroupRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: UpdateSourceGroupStatusInput,
  ): Promise<SourceGroup> {
    const sourceGroup = withDefaultSourceGroupEntryRoutes(
      await loadValidatedSourceGroupById(
        this.sourceGroups,
        input.sourceGroupId,
      ),
    );
    const updatedSourceGroup = validateSourceGroupForApplication({
      ...sourceGroup,
      status: input.status,
      updatedAt: toIsoDateTime(this.clock.now()),
    });

    await this.sourceGroups.save(updatedSourceGroup);

    return updatedSourceGroup;
  }
}
