import type {
  AddSourceGroupEntryRouteInput,
  CreateContentCategoryInput,
  CreateSourceGroupInput,
  GetContentItemInput,
  GetSourceGroupInput,
  GetSourcePublisherInput,
  ListContentItemsInput,
  ListContentItemsOutput,
  ListSourceGroupsInput,
  ListSourceGroupsOutput,
  ListSourcePublishersInput,
  ListSourcePublishersOutput,
  ObserveSourcePublisherApplicationInput,
  PromoteSourcePublisherToSourceGroupInput,
  RemoveSourceGroupEntryRouteInput,
  UpdateContentStatusInput,
  UpdateSourceGroupEntryRouteInput,
  UpdateSourceGroupStatusInput,
  UpdateSourcePublisherStatusInput,
} from "../../../content-manager/application";
import type {
  CollectedContentInput,
  ContentCategory,
  ContentItem,
  ContentStatus,
  HomeFeedCollectedContentInput,
  SourceGroup,
  SourceGroupStatus,
  SourcePublisher,
  TopComment,
} from "../../../content-manager/domain";
import { createDefaultSourceGroupEntryRoute } from "../../../content-manager/domain";
import type { ContentManagerHttpService } from "../routes/content-manager.routes";

export const contentManagerHttpTestNow = "2026-02-01T10:00:00.000Z";

export class StubUseCase<Input, Output> {
  public readonly calls: Input[] = [];
  private error: unknown;

  public constructor(private output: Output) {}

  public setOutput(output: Output): void {
    this.output = output;
  }

  public setError(error: unknown): void {
    this.error = error;
  }

  public async execute(input: Input): Promise<Output> {
    this.calls.push(input);

    if (this.error !== undefined) {
      throw this.error;
    }

    return this.output;
  }
}

export class StubNoInputUseCase<Output> {
  public calls = 0;
  private error: unknown;

  public constructor(private output: Output) {}

  public setOutput(output: Output): void {
    this.output = output;
  }

  public setError(error: unknown): void {
    this.error = error;
  }

  public async execute(): Promise<Output> {
    this.calls += 1;

    if (this.error !== undefined) {
      throw this.error;
    }

    return this.output;
  }
}

export interface FakeContentManagerHttpService
  extends ContentManagerHttpService {
  readonly createContentCategory: StubUseCase<
    CreateContentCategoryInput,
    ContentCategory
  >;
  readonly listContentCategories: StubNoInputUseCase<
    readonly ContentCategory[]
  >;
  readonly createSourceGroup: StubUseCase<
    CreateSourceGroupInput,
    SourceGroup
  >;
  readonly getSourceGroup: StubUseCase<GetSourceGroupInput, SourceGroup>;
  readonly addSourceGroupEntryRoute: StubUseCase<
    AddSourceGroupEntryRouteInput,
    SourceGroup
  >;
  readonly updateSourceGroupEntryRoute: StubUseCase<
    UpdateSourceGroupEntryRouteInput,
    SourceGroup
  >;
  readonly removeSourceGroupEntryRoute: StubUseCase<
    RemoveSourceGroupEntryRouteInput,
    SourceGroup
  >;
  readonly updateSourceGroupStatus: StubUseCase<
    UpdateSourceGroupStatusInput,
    SourceGroup
  >;
  readonly listSourceGroups: StubUseCase<
    ListSourceGroupsInput,
    ListSourceGroupsOutput
  >;
  readonly ingestCollectedContent: StubUseCase<
    CollectedContentInput,
    ContentItem
  >;
  readonly ingestHomeFeedCollectedContent: StubUseCase<
    HomeFeedCollectedContentInput,
    ContentItem
  >;
  readonly updateContentStatus: StubUseCase<
    UpdateContentStatusInput,
    ContentItem
  >;
  readonly getContentItem: StubUseCase<GetContentItemInput, ContentItem>;
  readonly listContentItems: StubUseCase<
    ListContentItemsInput,
    ListContentItemsOutput
  >;
  readonly observeSourcePublisher: StubUseCase<
    ObserveSourcePublisherApplicationInput,
    SourcePublisher
  >;
  readonly getSourcePublisher: StubUseCase<
    GetSourcePublisherInput,
    SourcePublisher
  >;
  readonly listSourcePublishers: StubUseCase<
    ListSourcePublishersInput,
    ListSourcePublishersOutput
  >;
  readonly updateSourcePublisherStatus: StubUseCase<
    UpdateSourcePublisherStatusInput,
    SourcePublisher
  >;
  readonly promoteSourcePublisherToSourceGroup: StubUseCase<
    PromoteSourcePublisherToSourceGroupInput,
    {
      readonly sourceGroup: SourceGroup;
      readonly outcome: "CREATED" | "ALREADY_EXISTS";
    }
  >;
}

export function createFakeContentManagerHttpService(): FakeContentManagerHttpService {
  const category = createContentCategory();
  const sourceGroup = createSourceGroup();
  const contentItem = createContentItem();
  const sourcePublisher = createSourcePublisher();

  return {
    createContentCategory: new StubUseCase(category),
    listContentCategories: new StubNoInputUseCase([category]),
    createSourceGroup: new StubUseCase(sourceGroup),
    getSourceGroup: new StubUseCase(sourceGroup),
    addSourceGroupEntryRoute: new StubUseCase(
      createSourceGroup({
        entryRoutes: [
          ...sourceGroup.entryRoutes,
          {
            id: "entry-route-2",
            type: "CATEGORY_ENTRY_URL",
            url: "https://facebook.test/groups/category-entry",
            label: "Category entry",
            riskLevel: "LOW",
            isDefault: false,
            createdAt: contentManagerHttpTestNow,
            updatedAt: contentManagerHttpTestNow,
          },
        ],
      }),
    ),
    updateSourceGroupEntryRoute: new StubUseCase(sourceGroup),
    removeSourceGroupEntryRoute: new StubUseCase(sourceGroup),
    updateSourceGroupStatus: new StubUseCase(
      createSourceGroup({ status: "PAUSED" }),
    ),
    listSourceGroups: new StubUseCase({
      items: [sourceGroup],
      page: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    }),
    ingestCollectedContent: new StubUseCase(contentItem),
    ingestHomeFeedCollectedContent: new StubUseCase(
      createContentItem({ sourceGroupId: undefined }),
    ),
    updateContentStatus: new StubUseCase(
      createContentItem({ status: "SELECTED" }),
    ),
    getContentItem: new StubUseCase(contentItem),
    listContentItems: new StubUseCase({
      items: [contentItem],
      page: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    }),
    observeSourcePublisher: new StubUseCase(sourcePublisher),
    getSourcePublisher: new StubUseCase(sourcePublisher),
    listSourcePublishers: new StubUseCase({
      items: [sourcePublisher],
      page: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    }),
    updateSourcePublisherStatus: new StubUseCase(
      createSourcePublisher({ status: "APPROVED" }),
    ),
    promoteSourcePublisherToSourceGroup: new StubUseCase({
      sourceGroup: createSourceGroup({ status: "PAUSED" }),
      outcome: "CREATED",
    }),
  };
}

export function createContentCategory(
  options: Partial<ContentCategory> = {},
): ContentCategory {
  return {
    id: options.id ?? "category-1",
    name: options.name ?? "Knowledge",
    slug: options.slug ?? "knowledge",
    ...(options.description !== undefined
      ? { description: options.description }
      : {}),
    createdAt: options.createdAt ?? contentManagerHttpTestNow,
    updatedAt: options.updatedAt ?? contentManagerHttpTestNow,
  };
}

export function createSourceGroup(
  options: Partial<SourceGroup> = {},
): SourceGroup {
  const base = {
    id: options.id ?? "source-group-1",
    platform: options.platform ?? "FACEBOOK",
    externalGroupId: options.externalGroupId ?? "fb-group-1",
    name: options.name ?? "Facebook Knowledge Group",
    url: options.url ?? "https://facebook.test/groups/fb-group-1",
    categoryId: options.categoryId ?? "category-1",
    status: options.status ?? "ACTIVE",
    collectionPriority: options.collectionPriority ?? 80,
    ...(options.notes !== undefined ? { notes: options.notes } : {}),
    createdAt: options.createdAt ?? contentManagerHttpTestNow,
    updatedAt: options.updatedAt ?? contentManagerHttpTestNow,
  } satisfies Omit<SourceGroup, "entryRoutes">;

  return {
    ...base,
    entryRoutes:
      options.entryRoutes ?? [createDefaultSourceGroupEntryRoute(base)],
    ...options,
  };
}

export function createContentItem(
  options: Partial<ContentItem> = {},
): ContentItem {
  const hasSourceGroupIdOverride = Object.prototype.hasOwnProperty.call(
    options,
    "sourceGroupId",
  );
  const sourceGroupId = hasSourceGroupIdOverride
    ? options.sourceGroupId
    : "source-group-1";
  const effectiveSourceGroupId =
    sourceGroupId ?? "source-group-1";

  return {
    id: options.id ?? "content-item-1",
    platform: options.platform ?? "FACEBOOK",
    ...(sourceGroupId !== undefined ? { sourceGroupId } : {}),
    externalPostId: options.externalPostId ?? "fb-post-1",
    sourceUrl: options.sourceUrl ?? "https://facebook.test/posts/fb-post-1",
    ...(options.title !== undefined ? { title: options.title } : {}),
    bodyText: options.bodyText ?? "A normalized collected post body.",
    ...(options.authorDisplayName !== undefined
      ? { authorDisplayName: options.authorDisplayName }
      : {}),
    ...(options.authorExternalId !== undefined
      ? { authorExternalId: options.authorExternalId }
      : {}),
    ...(options.postedAt !== undefined ? { postedAt: options.postedAt } : {}),
    firstCollectedAt: options.firstCollectedAt ?? contentManagerHttpTestNow,
    lastCollectedAt: options.lastCollectedAt ?? contentManagerHttpTestNow,
    reactionCount: options.reactionCount ?? 42,
    commentCount: options.commentCount ?? 7,
    ...(options.shareCount !== undefined
      ? { shareCount: options.shareCount }
      : {}),
    topComments: options.topComments ?? [createTopComment()],
    status: options.status ?? "COLLECTED",
    ...(options.rawPayloadRef !== undefined
      ? { rawPayloadRef: options.rawPayloadRef }
      : {}),
    collectionProvenance:
      options.collectionProvenance ?? {
        firstCollectionSurface: {
          kind: "SOURCE_GROUP",
          sourceGroupId: effectiveSourceGroupId,
        },
        managedSourceGroupId: effectiveSourceGroupId,
      },
    createdAt: options.createdAt ?? contentManagerHttpTestNow,
    updatedAt: options.updatedAt ?? contentManagerHttpTestNow,
  };
}

export function createTopComment(
  options: Partial<TopComment> = {},
): TopComment {
  return {
    externalCommentId: options.externalCommentId ?? "comment-1",
    bodyText: options.bodyText ?? "Useful comment.",
    ...(options.authorDisplayName !== undefined
      ? { authorDisplayName: options.authorDisplayName }
      : {}),
    ...(options.authorExternalId !== undefined
      ? { authorExternalId: options.authorExternalId }
      : {}),
    reactionCount: options.reactionCount ?? 12,
    ...(options.replyCount !== undefined ? { replyCount: options.replyCount } : {}),
    ...(options.postedAt !== undefined ? { postedAt: options.postedAt } : {}),
    collectedAt: options.collectedAt ?? contentManagerHttpTestNow,
  };
}

export function createCollectedContentInput(
  options: Partial<CollectedContentInput> = {},
): CollectedContentInput {
  return {
    platform: options.platform ?? "FACEBOOK",
    sourceGroupId: options.sourceGroupId ?? "source-group-1",
    externalPostId: options.externalPostId ?? "fb-post-1",
    sourceUrl: options.sourceUrl ?? "https://facebook.test/posts/fb-post-1",
    ...(options.title !== undefined ? { title: options.title } : {}),
    bodyText: options.bodyText ?? "A normalized collected post body.",
    ...(options.authorDisplayName !== undefined
      ? { authorDisplayName: options.authorDisplayName }
      : {}),
    ...(options.authorExternalId !== undefined
      ? { authorExternalId: options.authorExternalId }
      : {}),
    ...(options.postedAt !== undefined ? { postedAt: options.postedAt } : {}),
    collectedAt: options.collectedAt ?? contentManagerHttpTestNow,
    reactionCount: options.reactionCount ?? 42,
    commentCount: options.commentCount ?? 7,
    ...(options.shareCount !== undefined
      ? { shareCount: options.shareCount }
      : {}),
    topComments: options.topComments ?? [createTopComment()],
    ...(options.rawPayloadRef !== undefined
      ? { rawPayloadRef: options.rawPayloadRef }
      : {}),
  };
}

export function createHomeFeedCollectedContentInput(
  options: Partial<HomeFeedCollectedContentInput> = {},
): HomeFeedCollectedContentInput {
  return {
    sourcePublisherId: options.sourcePublisherId ?? "source-publisher-1",
    platform: options.platform ?? "FACEBOOK",
    externalPostId: options.externalPostId ?? "fb-post-1",
    sourceUrl: options.sourceUrl ?? "https://facebook.test/posts/fb-post-1",
    ...(options.title !== undefined ? { title: options.title } : {}),
    bodyText: options.bodyText ?? "A normalized collected post body.",
    ...(options.authorDisplayName !== undefined
      ? { authorDisplayName: options.authorDisplayName }
      : {}),
    ...(options.authorExternalId !== undefined
      ? { authorExternalId: options.authorExternalId }
      : {}),
    ...(options.postedAt !== undefined ? { postedAt: options.postedAt } : {}),
    collectedAt: options.collectedAt ?? contentManagerHttpTestNow,
    reactionCount: options.reactionCount ?? 42,
    commentCount: options.commentCount ?? 7,
    ...(options.shareCount !== undefined
      ? { shareCount: options.shareCount }
      : {}),
    topComments: options.topComments ?? [createTopComment()],
  };
}

export function createContentItemWithStatus(
  status: ContentStatus,
): ContentItem {
  return createContentItem({ status });
}

export function createSourceGroupWithStatus(
  status: SourceGroupStatus,
): SourceGroup {
  return createSourceGroup({ status });
}

export function createSourcePublisher(
  options: Partial<SourcePublisher> = {},
): SourcePublisher {
  return {
    id: options.id ?? "source-publisher-1",
    platform: options.platform ?? "FACEBOOK",
    kind: options.kind ?? "GROUP",
    externalPublisherId:
      options.externalPublisherId ?? "synthetic-group-123",
    ...(options.displayName !== undefined
      ? { displayName: options.displayName }
      : {}),
    ...(options.canonicalUrl !== undefined
      ? { canonicalUrl: options.canonicalUrl }
      : {}),
    status: options.status ?? "DISCOVERED",
    firstObservedAt:
      options.firstObservedAt ?? "2026-06-18T12:00:00.000Z",
    lastObservedAt:
      options.lastObservedAt ?? "2026-06-18T12:00:00.000Z",
    observationCount: options.observationCount ?? 1,
    createdAt: options.createdAt ?? "2026-06-18T12:00:01.000Z",
    updatedAt: options.updatedAt ?? "2026-06-18T12:00:01.000Z",
  };
}
