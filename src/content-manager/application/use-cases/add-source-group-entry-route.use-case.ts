import {
  loadValidatedSourceGroupById,
  toIsoDateTime,
  validateSourceGroupForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { SourceGroupRepository } from "../ports/source-group-repository.port";
import {
  resolveSourceGroupEntryRoutes,
  withDefaultSourceGroupEntryRoutes,
} from "../../domain";
import type {
  SourceGroup,
  SourceGroupEntryRouteRiskLevel,
  SourceGroupEntryRouteType,
  SourceGroupId,
} from "../../domain";

export interface AddSourceGroupEntryRouteInput {
  readonly sourceGroupId: SourceGroupId;
  readonly type: SourceGroupEntryRouteType;
  readonly url: string;
  readonly label?: string;
  readonly notes?: string;
  readonly riskLevel: SourceGroupEntryRouteRiskLevel;
  readonly isDefault?: boolean;
}

export class AddSourceGroupEntryRouteUseCase {
  public constructor(
    private readonly sourceGroups: SourceGroupRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: AddSourceGroupEntryRouteInput,
  ): Promise<SourceGroup> {
    const sourceGroup = withDefaultSourceGroupEntryRoutes(
      await loadValidatedSourceGroupById(
        this.sourceGroups,
        input.sourceGroupId,
      ),
    );
    const now = toIsoDateTime(this.clock.now());
    const newRoute = {
      id: await this.ids.generateId(),
      type: input.type,
      url: input.url,
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      riskLevel: input.riskLevel,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    };
    const entryRoutes = [...resolveSourceGroupEntryRoutes(sourceGroup), newRoute];
    const updatedSourceGroup = validateSourceGroupForApplication({
      ...sourceGroup,
      entryRoutes: newRoute.isDefault
        ? entryRoutes.map((route) => ({
            ...route,
            isDefault: route.id === newRoute.id,
          }))
        : entryRoutes,
      updatedAt: now,
    });

    await this.sourceGroups.save(updatedSourceGroup);

    return updatedSourceGroup;
  }
}
