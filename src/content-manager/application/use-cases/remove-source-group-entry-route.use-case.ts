import {
  ContentValidationError,
  SourceGroupEntryRouteNotFoundError,
} from "../application-errors";
import {
  loadValidatedSourceGroupById,
  toIsoDateTime,
  validateSourceGroupForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { SourceGroupRepository } from "../ports/source-group-repository.port";
import {
  resolveSourceGroupEntryRoutes,
  withDefaultSourceGroupEntryRoutes,
} from "../../domain";
import type {
  SourceGroup,
  SourceGroupEntryRouteId,
  SourceGroupId,
} from "../../domain";

export interface RemoveSourceGroupEntryRouteInput {
  readonly sourceGroupId: SourceGroupId;
  readonly entryRouteId: SourceGroupEntryRouteId;
}

export class RemoveSourceGroupEntryRouteUseCase {
  public constructor(
    private readonly sourceGroups: SourceGroupRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: RemoveSourceGroupEntryRouteInput,
  ): Promise<SourceGroup> {
    const sourceGroup = withDefaultSourceGroupEntryRoutes(
      await loadValidatedSourceGroupById(
        this.sourceGroups,
        input.sourceGroupId,
      ),
    );
    const entryRoutes = [...resolveSourceGroupEntryRoutes(sourceGroup)];
    const existingRoute = entryRoutes.find(
      (route) => route.id === input.entryRouteId,
    );

    if (existingRoute === undefined) {
      throw new SourceGroupEntryRouteNotFoundError(
        input.sourceGroupId,
        input.entryRouteId,
      );
    }

    if (existingRoute.isDefault) {
      throw new ContentValidationError([
        {
          path: "entryRouteId",
          message: "The default entry route cannot be deleted.",
        },
      ]);
    }

    const now = toIsoDateTime(this.clock.now());
    const updatedSourceGroup = validateSourceGroupForApplication({
      ...sourceGroup,
      entryRoutes: entryRoutes.filter(
        (route) => route.id !== input.entryRouteId,
      ),
      updatedAt: now,
    });

    await this.sourceGroups.save(updatedSourceGroup);

    return updatedSourceGroup;
  }
}
