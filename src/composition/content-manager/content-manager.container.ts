import {
  AddSourceGroupEntryRouteUseCase,
  CreateContentCategoryUseCase,
  CreateSourceGroupUseCase,
  GetContentItemUseCase,
  GetSourceGroupUseCase,
  IngestCollectedContentUseCase,
  ListContentCategoriesUseCase,
  ListContentItemsUseCase,
  ListSourceGroupsUseCase,
  RemoveSourceGroupEntryRouteUseCase,
  UpdateContentStatusUseCase,
  UpdateSourceGroupEntryRouteUseCase,
  UpdateSourceGroupStatusUseCase,
} from "../../content-manager/application";
import type {
  Clock,
  ContentCategoryRepository,
  ContentItemRepository,
  IdGenerator,
  SourceGroupRepository,
} from "../../content-manager/application";

export interface ContentManagerDependencies {
  readonly categories: ContentCategoryRepository;
  readonly sourceGroups: SourceGroupRepository;
  readonly contentItems: ContentItemRepository;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly close?: () => Promise<void>;
}

export interface ContentManagerContainer {
  readonly createContentCategory: CreateContentCategoryUseCase;
  readonly listContentCategories: ListContentCategoriesUseCase;
  readonly createSourceGroup: CreateSourceGroupUseCase;
  readonly getSourceGroup: GetSourceGroupUseCase;
  readonly addSourceGroupEntryRoute: AddSourceGroupEntryRouteUseCase;
  readonly updateSourceGroupEntryRoute: UpdateSourceGroupEntryRouteUseCase;
  readonly removeSourceGroupEntryRoute: RemoveSourceGroupEntryRouteUseCase;
  readonly updateSourceGroupStatus: UpdateSourceGroupStatusUseCase;
  readonly listSourceGroups: ListSourceGroupsUseCase;
  readonly ingestCollectedContent: IngestCollectedContentUseCase;
  readonly updateContentStatus: UpdateContentStatusUseCase;
  readonly getContentItem: GetContentItemUseCase;
  readonly listContentItems: ListContentItemsUseCase;
  close(): Promise<void>;
}

export function createContentManager(
  dependencies: ContentManagerDependencies,
): ContentManagerContainer {
  const {
    categories,
    sourceGroups,
    contentItems,
    clock,
    idGenerator,
  } = dependencies;

  return {
    createContentCategory: new CreateContentCategoryUseCase(
      categories,
      idGenerator,
      clock,
    ),
    listContentCategories: new ListContentCategoriesUseCase(categories),
    createSourceGroup: new CreateSourceGroupUseCase(
      sourceGroups,
      categories,
      idGenerator,
      clock,
    ),
    getSourceGroup: new GetSourceGroupUseCase(sourceGroups),
    addSourceGroupEntryRoute: new AddSourceGroupEntryRouteUseCase(
      sourceGroups,
      idGenerator,
      clock,
    ),
    updateSourceGroupEntryRoute: new UpdateSourceGroupEntryRouteUseCase(
      sourceGroups,
      clock,
    ),
    removeSourceGroupEntryRoute: new RemoveSourceGroupEntryRouteUseCase(
      sourceGroups,
      clock,
    ),
    updateSourceGroupStatus: new UpdateSourceGroupStatusUseCase(
      sourceGroups,
      clock,
    ),
    listSourceGroups: new ListSourceGroupsUseCase(sourceGroups),
    ingestCollectedContent: new IngestCollectedContentUseCase(
      contentItems,
      sourceGroups,
      idGenerator,
      clock,
    ),
    updateContentStatus: new UpdateContentStatusUseCase(contentItems, clock),
    getContentItem: new GetContentItemUseCase(contentItems),
    listContentItems: new ListContentItemsUseCase(contentItems),
    close: dependencies.close ?? noopClose,
  };
}

async function noopClose(): Promise<void> {}
