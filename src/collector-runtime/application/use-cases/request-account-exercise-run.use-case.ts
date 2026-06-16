import {
  toAccountExerciseRunIsoDateTime,
  validateAccountExerciseRunActionBudgetForApplication,
  validateAccountExerciseRunForApplication,
  validateCategoryBrowseExerciseTargetForApplication,
} from "../account-exercise-run-validation";
import {
  AccountExerciseSourceGroupNotActiveError,
  AccountExerciseSourceGroupNotFoundError,
  AccountExerciseSourceGroupPlatformUnsupportedError,
  AccountExerciseRunValidationError,
  CategoryBrowseEntryRouteNotEligibleError,
  CategoryBrowseEntryRouteNotFoundError,
  SourceGroupLookupFailedError,
} from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type { AccountExerciseRunRepository } from "../ports/account-exercise-run-repository.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type {
  SourceGroupLookupEntryRoute,
  SourceGroupLookupPort,
  SourceGroupLookupResult,
  SourceGroupLookupSourceGroup,
} from "../ports/source-group-lookup.port";
import type {
  AccountExerciseRun,
  AccountExerciseRunActionBudget,
  CategoryBrowseExerciseTarget,
  ValidationIssue,
} from "../../domain";
import {
  canonicalizeFacebookUrl,
  sameNormalizedUrl,
} from "../../domain";

interface RequestAccountExerciseRunBaseInput {
  readonly profileId: string;
  readonly stageAtStart: string;
  readonly maxDurationMs: number;
  readonly maxScrolls: number;
  readonly minDwellMs?: number;
}

export type RequestAccountExerciseRunInput =
  | (RequestAccountExerciseRunBaseInput & {
      readonly exerciseType?: "AMBIENT_ACCOUNT";
    })
  | (RequestAccountExerciseRunBaseInput & {
      readonly exerciseType: "CATEGORY_BROWSE";
      readonly sourceGroupId: string;
      readonly entryRouteId?: string;
    });

export class RequestAccountExerciseRunUseCase {
  public constructor(
    private readonly accountExerciseRuns: AccountExerciseRunRepository,
    private readonly sourceGroups: SourceGroupLookupPort,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: RequestAccountExerciseRunInput,
  ): Promise<AccountExerciseRun> {
    const actionBudget = validateAccountExerciseRunActionBudgetForApplication(
      toActionBudget(input),
    );
    const exerciseType = input.exerciseType ?? "AMBIENT_ACCOUNT";
    if (exerciseType === "AMBIENT_ACCOUNT" && (input as any).target !== undefined) {
      throw new AccountExerciseRunValidationError([
        {
          path: "target",
          message: "Ambient account exercise runs must not include a target.",
        },
      ]);
    }
    const target =
      input.exerciseType === "CATEGORY_BROWSE"
        ? await this.resolveCategoryBrowseTarget(input)
        : undefined;
    const now = toAccountExerciseRunIsoDateTime(this.clock.now());
    const accountExerciseRun = validateAccountExerciseRunForApplication({
      id: await this.ids.generateId(),
      profileId: input.profileId,
      exerciseType,
      status: "QUEUED",
      stageAtStart: input.stageAtStart,
      actionBudget,
      ...(target !== undefined ? { target } : {}),
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await this.accountExerciseRuns.save(accountExerciseRun);

    return accountExerciseRun;
  }

  private async resolveCategoryBrowseTarget(
    input: Extract<
      RequestAccountExerciseRunInput,
      { readonly exerciseType: "CATEGORY_BROWSE" }
    >,
  ): Promise<CategoryBrowseExerciseTarget> {
    const sourceGroupId = validateSourceGroupId(input.sourceGroupId);
    const lookupResult = await this.lookupSourceGroup(sourceGroupId);

    if (!lookupResult.ok) {
      throw toSourceGroupLookupError(sourceGroupId, lookupResult);
    }

    const sourceGroup = lookupResult.sourceGroup;

    if (sourceGroup.id !== sourceGroupId) {
      throw new SourceGroupLookupFailedError(
        sourceGroupId,
        "Content Manager returned a different source group id.",
      );
    }

    validateCategoryBrowseSourceGroup(sourceGroupId, sourceGroup);

    const canonicalSourceUrl = canonicalizeFacebookUrl(sourceGroup.url);
    if (canonicalSourceUrl === undefined) {
      throw new SourceGroupLookupFailedError(
        sourceGroupId,
        "Source group URL is not a valid HTTPS Facebook URL.",
      );
    }

    const selectedRoute = selectCategoryBrowseEntryRoute({
      sourceGroup,
      canonicalSourceUrl,
      ...(input.entryRouteId !== undefined
        ? { entryRouteId: input.entryRouteId }
        : {}),
    });

    return validateCategoryBrowseExerciseTargetForApplication({
      categoryId: sourceGroup.categoryId,
      sourceGroupId,
      entryRouteId: selectedRoute.id,
      entryRouteType: "CATEGORY_ENTRY_URL",
      url: selectedRoute.url,
      riskLevel: selectedRoute.riskLevel,
    });
  }

  private async lookupSourceGroup(
    sourceGroupId: string,
  ): Promise<SourceGroupLookupResult> {
    try {
      return await this.sourceGroups.getSourceGroup(sourceGroupId);
    } catch (error) {
      throw new SourceGroupLookupFailedError(
        sourceGroupId,
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Could not resolve the source group from Content Manager.",
      );
    }
  }
}

function toActionBudget(
  input: RequestAccountExerciseRunInput,
): AccountExerciseRunActionBudget {
  return {
    maxDurationMs: input.maxDurationMs,
    maxScrolls: input.maxScrolls,
    ...(input.minDwellMs !== undefined ? { minDwellMs: input.minDwellMs } : {}),
  };
}

function validateSourceGroupId(sourceGroupId: string): string {
  const issues: ValidationIssue[] = [];

  if (typeof sourceGroupId !== "string" || sourceGroupId.trim().length === 0) {
    issues.push({
      path: "sourceGroupId",
      message: "sourceGroupId must be a non-empty string.",
    });
  }

  if (issues.length > 0) {
    throw new AccountExerciseRunValidationError(issues);
  }

  return sourceGroupId;
}

function validateCategoryBrowseSourceGroup(
  sourceGroupId: string,
  sourceGroup: SourceGroupLookupSourceGroup,
): void {
  if (sourceGroup.platform !== "FACEBOOK") {
    throw new AccountExerciseSourceGroupPlatformUnsupportedError(
      sourceGroupId,
      sourceGroup.platform,
    );
  }

  if (sourceGroup.status !== "ACTIVE") {
    throw new AccountExerciseSourceGroupNotActiveError(
      sourceGroupId,
      sourceGroup.status,
    );
  }
}

function selectCategoryBrowseEntryRoute(input: {
  readonly sourceGroup: SourceGroupLookupSourceGroup;
  readonly canonicalSourceUrl: string;
  readonly entryRouteId?: string;
}): SourceGroupLookupEntryRoute & {
  readonly type: "CATEGORY_ENTRY_URL";
  readonly riskLevel: "LOW" | "MEDIUM";
} {
  if (input.entryRouteId !== undefined) {
    const explicitRoute = input.sourceGroup.entryRoutes?.find(
      (route) => route.id === input.entryRouteId,
    );

    if (explicitRoute === undefined) {
      throw new CategoryBrowseEntryRouteNotFoundError(
        input.sourceGroup.id,
        input.entryRouteId,
      );
    }

    return validateEligibleCategoryBrowseEntryRoute(
      input.sourceGroup,
      explicitRoute,
      input.canonicalSourceUrl,
    );
  }

  const selectedRoute = [...(input.sourceGroup.entryRoutes ?? [])]
    .map((route) =>
      tryValidateEligibleCategoryBrowseEntryRoute(
        input.sourceGroup,
        route,
        input.canonicalSourceUrl,
      ),
    )
    .filter(
      (
        route,
      ): route is SourceGroupLookupEntryRoute & {
        readonly type: "CATEGORY_ENTRY_URL";
        readonly riskLevel: "LOW" | "MEDIUM";
      } => route !== undefined,
    )
    .sort(compareCategoryBrowseEntryRoutes)[0];

  if (selectedRoute === undefined) {
    throw new CategoryBrowseEntryRouteNotEligibleError(
      input.sourceGroup.id,
      `Source group ${input.sourceGroup.id} does not have an eligible CATEGORY_ENTRY_URL route for Category Browse exercise.`,
    );
  }

  return selectedRoute;
}

function validateEligibleCategoryBrowseEntryRoute(
  sourceGroup: SourceGroupLookupSourceGroup,
  route: SourceGroupLookupEntryRoute,
  canonicalSourceUrl: string,
): SourceGroupLookupEntryRoute & {
  readonly type: "CATEGORY_ENTRY_URL";
  readonly riskLevel: "LOW" | "MEDIUM";
} {
  const eligibleRoute = tryValidateEligibleCategoryBrowseEntryRoute(
    sourceGroup,
    route,
    canonicalSourceUrl,
  );

  if (eligibleRoute === undefined) {
    throw new CategoryBrowseEntryRouteNotEligibleError(
      sourceGroup.id,
      `Entry route ${route.id} is not eligible for Category Browse exercise.`,
    );
  }

  return eligibleRoute;
}

function tryValidateEligibleCategoryBrowseEntryRoute(
  sourceGroup: SourceGroupLookupSourceGroup,
  route: SourceGroupLookupEntryRoute,
  canonicalSourceUrl: string,
):
  | (SourceGroupLookupEntryRoute & {
      readonly type: "CATEGORY_ENTRY_URL";
      readonly riskLevel: "LOW" | "MEDIUM";
    })
  | undefined {
  if (route.type !== "CATEGORY_ENTRY_URL") {
    return undefined;
  }

  const canonicalRouteUrl = canonicalizeFacebookUrl(route.url);
  if (canonicalRouteUrl === undefined) {
    throw new SourceGroupLookupFailedError(
      sourceGroup.id,
      "Candidate route URL is not a valid HTTPS Facebook URL.",
    );
  }

  if (route.riskLevel !== "LOW" && route.riskLevel !== "MEDIUM") {
    return undefined;
  }

  if (canonicalRouteUrl === canonicalSourceUrl) {
    return undefined;
  }

  return {
    ...route,
    type: "CATEGORY_ENTRY_URL",
    riskLevel: route.riskLevel,
  };
}

function compareCategoryBrowseEntryRoutes(
  left: SourceGroupLookupEntryRoute,
  right: SourceGroupLookupEntryRoute,
): number {
  const riskComparison = riskSortValue(left.riskLevel) - riskSortValue(right.riskLevel);

  if (riskComparison !== 0) {
    return riskComparison;
  }

  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1;
  }

  return left.id.localeCompare(right.id);
}

function riskSortValue(riskLevel: string): number {
  return riskLevel === "LOW" ? 0 : 1;
}

function toSourceGroupLookupError(
  sourceGroupId: string,
  lookupResult: Extract<SourceGroupLookupResult, { readonly ok: false }>,
): Error {
  if (
    lookupResult.errorCode === "SOURCE_GROUP_NOT_FOUND" ||
    lookupResult.statusCode === 404
  ) {
    return new AccountExerciseSourceGroupNotFoundError(sourceGroupId);
  }

  return new SourceGroupLookupFailedError(
    sourceGroupId,
    lookupResult.errorMessage,
    {
      causeCode: lookupResult.errorCode,
      ...(lookupResult.statusCode !== undefined
        ? { statusCode: lookupResult.statusCode }
        : {}),
    },
  );
}

export type { SourceGroupLookupSourceGroup };
// Re-export URL utilities that external consumers may have imported from here.
export { canonicalizeFacebookUrl, sameNormalizedUrl };
