import {
  AddSourceGroupEntryRouteUseCase,
  CreateContentCategoryUseCase,
  CreateSourceGroupUseCase,
  GetContentItemUseCase,
  GetSourceGroupUseCase,
  GetSourcePublisherUseCase,
  IngestCollectedContentUseCase,
  IngestHomeFeedCollectedContentUseCase,
  ListContentCategoriesUseCase,
  ListContentItemsUseCase,
  ListSourceGroupsUseCase,
  ListSourcePublishersUseCase,
  ObserveSourcePublisherUseCase,
  RemoveSourceGroupEntryRouteUseCase,
  UpdateContentStatusUseCase,
  UpdateSourceGroupEntryRouteUseCase,
  UpdateSourceGroupStatusUseCase,
  UpdateSourcePublisherStatusUseCase,
} from "../../content-manager/application";
import type {
  Clock,
  ContentCategoryRepository,
  ContentItemRepository,
  IdGenerator,
  SourceGroupRepository,
  SourcePublisherRepository,
} from "../../content-manager/application";

export interface ContentManagerDependencies {
  readonly categories: ContentCategoryRepository;
  readonly sourceGroups: SourceGroupRepository;
  readonly contentItems: ContentItemRepository;
  readonly sourcePublishers: SourcePublisherRepository;
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
  readonly ingestHomeFeedCollectedContent: IngestHomeFeedCollectedContentUseCase;
  readonly updateContentStatus: UpdateContentStatusUseCase;
  readonly getContentItem: GetContentItemUseCase;
  readonly listContentItems: ListContentItemsUseCase;
  readonly observeSourcePublisher: ObserveSourcePublisherUseCase;
  readonly getSourcePublisher: GetSourcePublisherUseCase;
  readonly listSourcePublishers: ListSourcePublishersUseCase;
  readonly updateSourcePublisherStatus: UpdateSourcePublisherStatusUseCase;
  close(): Promise<void>;
}

export function createContentManager(
  dependencies: ContentManagerDependencies,
): ContentManagerContainer {
  const {
    categories,
    sourceGroups,
    contentItems,
    sourcePublishers,
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
    ingestHomeFeedCollectedContent: new IngestHomeFeedCollectedContentUseCase(
      contentItems,
      sourcePublishers,
      idGenerator,
      clock,
    ),
    updateContentStatus: new UpdateContentStatusUseCase(contentItems, clock),
    getContentItem: new GetContentItemUseCase(contentItems),
    listContentItems: new ListContentItemsUseCase(contentItems),
    observeSourcePublisher: new ObserveSourcePublisherUseCase(
      sourcePublishers,
      idGenerator,
      clock,
    ),
    getSourcePublisher: new GetSourcePublisherUseCase(sourcePublishers),
    listSourcePublishers: new ListSourcePublishersUseCase(sourcePublishers),
    updateSourcePublisherStatus: new UpdateSourcePublisherStatusUseCase(
      sourcePublishers,
      clock,
    ),
    close: dependencies.close ?? noopClose,
  };
}

async function noopClose(): Promise<void> {}
