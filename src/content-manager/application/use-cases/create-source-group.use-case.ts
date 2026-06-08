import { SourceGroupAlreadyExistsError } from "../application-errors";
import {
  loadValidatedContentCategoryById,
  toIsoDateTime,
  validateSourceGroupForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { ContentCategoryRepository } from "../ports/content-category-repository.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { SourceGroupRepository } from "../ports/source-group-repository.port";
import type {
  ContentCategoryId,
  ContentPlatform,
  ExternalGroupId,
  SourceGroup,
  SourceGroupStatus,
} from "../../domain";

export interface CreateSourceGroupInput {
  readonly platform: ContentPlatform;
  readonly externalGroupId: ExternalGroupId;
  readonly name: string;
  readonly url: string;
  readonly categoryId: ContentCategoryId;
  readonly status?: SourceGroupStatus;
  readonly collectionPriority: number;
  readonly notes?: string;
}

export class CreateSourceGroupUseCase {
  public constructor(
    private readonly sourceGroups: SourceGroupRepository,
    private readonly categories: ContentCategoryRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(input: CreateSourceGroupInput): Promise<SourceGroup> {
    const now = toIsoDateTime(this.clock.now());
    const sourceGroup = validateSourceGroupForApplication({
      id: await this.ids.generateId(),
      platform: input.platform,
      externalGroupId: input.externalGroupId,
      name: input.name,
      url: input.url,
      categoryId: input.categoryId,
      status: input.status ?? "ACTIVE",
      collectionPriority: input.collectionPriority,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      createdAt: now,
      updatedAt: now,
    });

    await loadValidatedContentCategoryById(
      this.categories,
      sourceGroup.categoryId,
    );

    const existingSourceGroup =
      await this.sourceGroups.findByPlatformAndExternalGroupId(
        sourceGroup.platform,
        sourceGroup.externalGroupId,
      );

    if (existingSourceGroup !== null) {
      throw new SourceGroupAlreadyExistsError(
        sourceGroup.platform,
        sourceGroup.externalGroupId,
      );
    }

    await this.sourceGroups.save(sourceGroup);

    return sourceGroup;
  }
}
