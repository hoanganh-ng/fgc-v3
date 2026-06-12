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
  SourceGroupEntryRoute,
  SourceGroupEntryRouteId,
  SourceGroupEntryRouteRiskLevel,
  SourceGroupEntryRouteType,
  SourceGroupId,
} from "../../domain";

export interface UpdateSourceGroupEntryRouteInput {
  readonly sourceGroupId: SourceGroupId;
  readonly entryRouteId: SourceGroupEntryRouteId;
  readonly type?: SourceGroupEntryRouteType;
  readonly url?: string;
  readonly label?: string | null;
  readonly notes?: string | null;
  readonly riskLevel?: SourceGroupEntryRouteRiskLevel;
  readonly isDefault?: boolean;
}

export class UpdateSourceGroupEntryRouteUseCase {
  public constructor(
    private readonly sourceGroups: SourceGroupRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: UpdateSourceGroupEntryRouteInput,
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

    if (existingRoute.isDefault && input.isDefault === false) {
      throw new ContentValidationError([
        {
          path: "isDefault",
          message:
            "The current default entry route cannot be cleared without choosing another default route.",
        },
      ]);
    }

    const now = toIsoDateTime(this.clock.now());
    const updatedRoute: SourceGroupEntryRoute = {
      id: existingRoute.id,
      type: input.type ?? existingRoute.type,
      url: input.url ?? existingRoute.url,
      ...optionalTextUpdate("label", existingRoute.label, input.label),
      ...optionalTextUpdate("notes", existingRoute.notes, input.notes),
      riskLevel: input.riskLevel ?? existingRoute.riskLevel,
      isDefault: input.isDefault ?? existingRoute.isDefault,
      createdAt: existingRoute.createdAt,
      updatedAt: now,
    };
    const updatedRoutes = entryRoutes.map((route) => {
      if (route.id === input.entryRouteId) {
        return updatedRoute;
      }

      if (input.isDefault === true) {
        return {
          ...route,
          isDefault: false,
        };
      }

      return route;
    });
    const updatedSourceGroup = validateSourceGroupForApplication({
      ...sourceGroup,
      entryRoutes: updatedRoutes,
      updatedAt: now,
    });

    await this.sourceGroups.save(updatedSourceGroup);

    return updatedSourceGroup;
  }
}

function optionalTextUpdate(
  key: "label" | "notes",
  currentValue: string | undefined,
  inputValue: string | null | undefined,
): Record<string, string> | Record<string, never> {
  if (inputValue === null) {
    return {};
  }

  if (inputValue !== undefined) {
    return {
      [key]: inputValue,
    };
  }

  if (currentValue !== undefined) {
    return {
      [key]: currentValue,
    };
  }

  return {};
}
