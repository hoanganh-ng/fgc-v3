import type {
  CreateContentCategoryInput,
  CreateSourceGroupInput,
  GetContentItemInput,
  ListContentItemsInput,
  ListContentItemsOutput,
  ListSourceGroupsInput,
  ListSourceGroupsOutput,
  UpdateContentStatusInput,
  UpdateSourceGroupStatusInput,
} from "../../../content-manager/application";
import type {
  CollectedContentInput,
  ContentCategory,
  ContentItem,
  ContentStatus,
  SourceGroup,
  SourceGroupStatus,
  TopComment,
} from "../../../content-manager/domain";
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
  readonly updateContentStatus: StubUseCase<
    UpdateContentStatusInput,
    ContentItem
  >;
  readonly getContentItem: StubUseCase<GetContentItemInput, ContentItem>;
  readonly listContentItems: StubUseCase<
    ListContentItemsInput,
    ListContentItemsOutput
  >;
}

export function createFakeContentManagerHttpService(): FakeContentManagerHttpService {
  const category = createContentCategory();
  const sourceGroup = createSourceGroup();
  const contentItem = createContentItem();

  return {
    createContentCategory: new StubUseCase(category),
    listContentCategories: new StubNoInputUseCase([category]),
    createSourceGroup: new StubUseCase(sourceGroup),
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
  return {
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
  };
}

export function createContentItem(
  options: Partial<ContentItem> = {},
): ContentItem {
  return {
    id: options.id ?? "content-item-1",
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
