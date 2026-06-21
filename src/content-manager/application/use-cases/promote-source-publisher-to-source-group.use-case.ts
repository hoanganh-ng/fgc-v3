import {
  SourcePublisherNotFoundError,
  SourcePublisherNotPromotableError,
} from "../application-errors";
import {
  loadValidatedContentCategoryById,
  loadValidatedSourcePublisherById,
  toIsoDateTime,
  validateSourceGroupForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { ContentCategoryRepository } from "../ports/content-category-repository.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { SourceGroupRepository } from "../ports/source-group-repository.port";
import type { SourcePublisherRepository } from "../ports/source-publisher-repository.port";
import { createDefaultSourceGroupEntryRoute } from "../../domain";
import type {
  ContentCategoryId,
  SourceGroup,
  SourcePublisherId,
} from "../../domain";

export type PromoteSourcePublisherToSourceGroupOutcome =
  | "CREATED"
  | "ALREADY_EXISTS";

export interface PromoteSourcePublisherToSourceGroupInput {
  readonly sourcePublisherId: SourcePublisherId;
  readonly categoryId: ContentCategoryId;
  readonly collectionPriority: number;
  readonly name?: string;
  readonly url?: string;
  readonly notes?: string;
}

export interface PromoteSourcePublisherToSourceGroupResult {
  readonly sourceGroup: SourceGroup;
  readonly outcome: PromoteSourcePublisherToSourceGroupOutcome;
}

export class PromoteSourcePublisherToSourceGroupUseCase {
  public constructor(
    private readonly sourcePublishers: SourcePublisherRepository,
    private readonly sourceGroups: SourceGroupRepository,
    private readonly categories: ContentCategoryRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: PromoteSourcePublisherToSourceGroupInput,
  ): Promise<PromoteSourcePublisherToSourceGroupResult> {
    const sourcePublisher = await loadValidatedSourcePublisherById(
      this.sourcePublishers,
      input.sourcePublisherId,
    );

    if (sourcePublisher.platform !== "FACEBOOK") {
      throw new SourcePublisherNotPromotableError(
        sourcePublisher.id,
        "NOT_FACEBOOK",
      );
    }

    if (sourcePublisher.kind !== "GROUP") {
      throw new SourcePublisherNotPromotableError(
        sourcePublisher.id,
        "NOT_GROUP",
      );
    }

    if (sourcePublisher.status !== "APPROVED") {
      throw new SourcePublisherNotPromotableError(
        sourcePublisher.id,
        "NOT_APPROVED",
      );
    }

    const existingSourceGroup =
      await this.sourceGroups.findByPlatformAndExternalGroupId(
        sourcePublisher.platform,
        sourcePublisher.externalPublisherId,
      );

    if (existingSourceGroup !== null) {
      const validatedExisting =
        validateSourceGroupForApplication(existingSourceGroup);

      return {
        sourceGroup: validatedExisting,
        outcome: "ALREADY_EXISTS",
      };
    }

    const resolvedUrl = input.url ?? sourcePublisher.canonicalUrl;

    if (resolvedUrl === undefined || resolvedUrl.trim().length === 0) {
      throw new SourcePublisherNotFoundError(sourcePublisher.id);
    }

    await loadValidatedContentCategoryById(
      this.categories,
      input.categoryId,
    );

    const now = toIsoDateTime(this.clock.now());
    const resolvedName =
      input.name ?? sourcePublisher.displayName ?? sourcePublisher.externalPublisherId;

    const candidate: SourceGroup = validateSourceGroupForApplication({
      id: await this.ids.generateId(),
      platform: sourcePublisher.platform,
      externalGroupId: sourcePublisher.externalPublisherId,
      name: resolvedName,
      url: resolvedUrl,
      categoryId: input.categoryId,
      status: "PAUSED",
      collectionPriority: input.collectionPriority,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      entryRoutes: [
        createDefaultSourceGroupEntryRoute({
          url: resolvedUrl,
          createdAt: now,
          updatedAt: now,
        }),
      ],
      createdAt: now,
      updatedAt: now,
    });

    const raceExistingSourceGroup =
      await this.sourceGroups.findByPlatformAndExternalGroupId(
        candidate.platform,
        candidate.externalGroupId,
      );

    if (raceExistingSourceGroup !== null) {
      const validatedRaceExisting =
        validateSourceGroupForApplication(raceExistingSourceGroup);

      return {
        sourceGroup: validatedRaceExisting,
        outcome: "ALREADY_EXISTS",
      };
    }

    await this.sourceGroups.save(candidate);

    return {
      sourceGroup: candidate,
      outcome: "CREATED",
    };
  }
}
