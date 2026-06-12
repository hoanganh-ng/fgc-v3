import type { FastifyInstance } from "fastify";
import type {
  AddSourceGroupEntryRouteInput,
  CreateContentCategoryInput,
  CreateSourceGroupInput,
  GetContentItemInput,
  GetSourceGroupInput,
  ListContentItemsInput,
  ListContentItemsOutput,
  ListSourceGroupsInput,
  ListSourceGroupsOutput,
  RemoveSourceGroupEntryRouteInput,
  UpdateContentStatusInput,
  UpdateSourceGroupEntryRouteInput,
  UpdateSourceGroupStatusInput,
} from "../../../content-manager/application";
import type {
  CollectedContentInput,
  ContentCategory,
  ContentId,
  ContentItem,
  ContentPlatform,
  ContentStatus,
  IsoDateTime,
  SourceGroup,
  SourceGroupEntryRoute,
  SourceGroupEntryRouteRiskLevel,
  SourceGroupEntryRouteType,
  SourceGroupId,
  SourceGroupStatus,
  TopComment,
} from "../../../content-manager/domain";
import { resolveSourceGroupEntryRoutes } from "../../../content-manager/domain";
import {
  ContentItemIdHttpParamsSchema,
  CreateContentCategoryHttpBodySchema,
  CreateSourceGroupEntryRouteHttpBodySchema,
  CreateSourceGroupHttpBodySchema,
  IngestCollectedContentHttpBodySchema,
  ListContentItemsHttpQuerySchema,
  ListSourceGroupsHttpQuerySchema,
  SourceGroupEntryRouteIdHttpParamsSchema,
  SourceGroupIdHttpParamsSchema,
  UpdateContentStatusHttpBodySchema,
  UpdateSourceGroupEntryRouteHttpBodySchema,
  UpdateSourceGroupStatusHttpBodySchema,
  createContentCategoryHttpRouteSchema,
  createSourceGroupEntryRouteHttpRouteSchema,
  createSourceGroupHttpRouteSchema,
  getContentItemHttpRouteSchema,
  getSourceGroupHttpRouteSchema,
  ingestCollectedContentHttpRouteSchema,
  listContentCategoriesHttpRouteSchema,
  listContentItemsHttpRouteSchema,
  listSourceGroupsHttpRouteSchema,
  parseHttpInput,
  removeSourceGroupEntryRouteHttpRouteSchema,
  updateContentStatusHttpRouteSchema,
  updateSourceGroupEntryRouteHttpRouteSchema,
  updateSourceGroupStatusHttpRouteSchema,
} from "../schemas/content-manager.http-schemas";

interface ExecutableUseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

interface ExecutableNoInput<Output> {
  execute(): Promise<Output>;
}

export interface ContentManagerHttpService {
  readonly createContentCategory: ExecutableUseCase<
    CreateContentCategoryInput,
    ContentCategory
  >;
  readonly listContentCategories: ExecutableNoInput<
    readonly ContentCategory[]
  >;
  readonly createSourceGroup: ExecutableUseCase<
    CreateSourceGroupInput,
    SourceGroup
  >;
  readonly getSourceGroup: ExecutableUseCase<GetSourceGroupInput, SourceGroup>;
  readonly addSourceGroupEntryRoute: ExecutableUseCase<
    AddSourceGroupEntryRouteInput,
    SourceGroup
  >;
  readonly updateSourceGroupEntryRoute: ExecutableUseCase<
    UpdateSourceGroupEntryRouteInput,
    SourceGroup
  >;
  readonly removeSourceGroupEntryRoute: ExecutableUseCase<
    RemoveSourceGroupEntryRouteInput,
    SourceGroup
  >;
  readonly updateSourceGroupStatus: ExecutableUseCase<
    UpdateSourceGroupStatusInput,
    SourceGroup
  >;
  readonly listSourceGroups: ExecutableUseCase<
    ListSourceGroupsInput,
    ListSourceGroupsOutput
  >;
  readonly ingestCollectedContent: ExecutableUseCase<
    CollectedContentInput,
    ContentItem
  >;
  readonly updateContentStatus: ExecutableUseCase<
    UpdateContentStatusInput,
    ContentItem
  >;
  readonly getContentItem: ExecutableUseCase<GetContentItemInput, ContentItem>;
  readonly listContentItems: ExecutableUseCase<
    ListContentItemsInput,
    ListContentItemsOutput
  >;
}

export interface RegisterContentManagerRoutesOptions {
  readonly contentManager: ContentManagerHttpService;
}

export interface ContentCategoryDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface SourceGroupDto {
  readonly id: SourceGroupId;
  readonly platform: ContentPlatform;
  readonly externalGroupId: string;
  readonly name: string;
  readonly url: string;
  readonly categoryId: string;
  readonly status: SourceGroupStatus;
  readonly collectionPriority: number;
  readonly notes?: string;
  readonly entryRoutes: readonly SourceGroupEntryRouteDto[];
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface SourceGroupEntryRouteDto {
  readonly id: string;
  readonly type: SourceGroupEntryRouteType;
  readonly url: string;
  readonly label?: string;
  readonly notes?: string;
  readonly riskLevel: SourceGroupEntryRouteRiskLevel;
  readonly isDefault: boolean;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface TopCommentDto {
  readonly externalCommentId: string;
  readonly bodyText: string;
  readonly authorDisplayName?: string;
  readonly authorExternalId?: string;
  readonly reactionCount: number;
  readonly replyCount?: number;
  readonly postedAt?: IsoDateTime;
  readonly collectedAt: IsoDateTime;
}

export interface ContentItemDto {
  readonly id: ContentId;
  readonly platform: ContentPlatform;
  readonly sourceGroupId: SourceGroupId;
  readonly externalPostId: string;
  readonly sourceUrl: string;
  readonly title?: string;
  readonly bodyText: string;
  readonly authorDisplayName?: string;
  readonly authorExternalId?: string;
  readonly postedAt?: IsoDateTime;
  readonly firstCollectedAt: IsoDateTime;
  readonly lastCollectedAt: IsoDateTime;
  readonly reactionCount: number;
  readonly commentCount: number;
  readonly shareCount?: number;
  readonly topComments: readonly TopCommentDto[];
  readonly status: ContentStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export function registerContentManagerRoutes(
  server: FastifyInstance,
  options: RegisterContentManagerRoutesOptions,
): void {
  const { contentManager } = options;

  server.post(
    "/collector/content-categories",
    { schema: createContentCategoryHttpRouteSchema },
    async (request, reply) => {
      const body = parseHttpInput(
        CreateContentCategoryHttpBodySchema,
        request.body,
      );
      const input = {
        name: body.name,
        slug: body.slug,
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
      } satisfies CreateContentCategoryInput;
      const category =
        await contentManager.createContentCategory.execute(input);

      return reply.code(201).send({
        category: toContentCategoryDto(category),
      });
    },
  );

  server.get(
    "/collector/content-categories",
    { schema: listContentCategoriesHttpRouteSchema },
    async () => {
      const categories =
        await contentManager.listContentCategories.execute();

      return {
        items: categories.map(toContentCategoryDto),
      };
    },
  );

  server.post(
    "/collector/source-groups",
    { schema: createSourceGroupHttpRouteSchema },
    async (request, reply) => {
      const body = parseHttpInput(
        CreateSourceGroupHttpBodySchema,
        request.body,
      );
      const input = {
        platform: body.platform,
        externalGroupId: body.externalGroupId,
        name: body.name,
        url: body.url,
        categoryId: body.categoryId,
        ...(body.status !== undefined ? { status: body.status } : {}),
        collectionPriority: body.collectionPriority,
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      } satisfies CreateSourceGroupInput;
      const sourceGroup = await contentManager.createSourceGroup.execute(input);

      return reply.code(201).send({
        sourceGroup: toSourceGroupDto(sourceGroup),
      });
    },
  );

  server.get(
    "/collector/source-groups",
    { schema: listSourceGroupsHttpRouteSchema },
    async (request) => {
      const query = parseHttpInput(
        ListSourceGroupsHttpQuerySchema,
        request.query,
      );
      const input = {
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.categoryId !== undefined
          ? { categoryId: query.categoryId }
          : {}),
        limit: query.limit,
        offset: query.offset,
      } satisfies ListSourceGroupsInput;
      const output = await contentManager.listSourceGroups.execute(input);

      return {
        items: output.items.map(toSourceGroupDto),
        page: output.page,
      };
    },
  );

  server.get(
    "/collector/source-groups/:sourceGroupId",
    { schema: getSourceGroupHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        SourceGroupIdHttpParamsSchema,
        request.params,
      );
      const sourceGroup = await contentManager.getSourceGroup.execute({
        sourceGroupId: params.sourceGroupId,
      });

      return {
        sourceGroup: toSourceGroupDto(sourceGroup),
      };
    },
  );

  server.post(
    "/collector/source-groups/:sourceGroupId/entry-routes",
    { schema: createSourceGroupEntryRouteHttpRouteSchema },
    async (request, reply) => {
      const params = parseHttpInput(
        SourceGroupIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        CreateSourceGroupEntryRouteHttpBodySchema,
        request.body,
      );
      const sourceGroup =
        await contentManager.addSourceGroupEntryRoute.execute({
          sourceGroupId: params.sourceGroupId,
          type: body.type,
          url: body.url,
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          riskLevel: body.riskLevel,
          ...(body.isDefault !== undefined
            ? { isDefault: body.isDefault }
            : {}),
        });

      return reply.code(201).send({
        sourceGroup: toSourceGroupDto(sourceGroup),
      });
    },
  );

  server.patch(
    "/collector/source-groups/:sourceGroupId/entry-routes/:entryRouteId",
    { schema: updateSourceGroupEntryRouteHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        SourceGroupEntryRouteIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        UpdateSourceGroupEntryRouteHttpBodySchema,
        request.body,
      );
      const sourceGroup =
        await contentManager.updateSourceGroupEntryRoute.execute({
          sourceGroupId: params.sourceGroupId,
          entryRouteId: params.entryRouteId,
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.url !== undefined ? { url: body.url } : {}),
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.riskLevel !== undefined ? { riskLevel: body.riskLevel } : {}),
          ...(body.isDefault !== undefined
            ? { isDefault: body.isDefault }
            : {}),
        });

      return {
        sourceGroup: toSourceGroupDto(sourceGroup),
      };
    },
  );

  server.delete(
    "/collector/source-groups/:sourceGroupId/entry-routes/:entryRouteId",
    { schema: removeSourceGroupEntryRouteHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        SourceGroupEntryRouteIdHttpParamsSchema,
        request.params,
      );
      const sourceGroup =
        await contentManager.removeSourceGroupEntryRoute.execute({
          sourceGroupId: params.sourceGroupId,
          entryRouteId: params.entryRouteId,
        });

      return {
        sourceGroup: toSourceGroupDto(sourceGroup),
      };
    },
  );

  server.patch(
    "/collector/source-groups/:sourceGroupId/status",
    { schema: updateSourceGroupStatusHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        SourceGroupIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        UpdateSourceGroupStatusHttpBodySchema,
        request.body,
      );
      const sourceGroup =
        await contentManager.updateSourceGroupStatus.execute({
          sourceGroupId: params.sourceGroupId,
          status: body.status,
        });

      return {
        sourceGroup: toSourceGroupDto(sourceGroup),
      };
    },
  );

  server.post(
    "/collector/content-items",
    { schema: ingestCollectedContentHttpRouteSchema },
    async (request) => {
      const body = parseHttpInput(
        IngestCollectedContentHttpBodySchema,
        request.body,
      );
      const contentItem =
        await contentManager.ingestCollectedContent.execute(body);

      return {
        contentItem: toContentItemDto(contentItem),
      };
    },
  );

  server.get(
    "/collector/content-items",
    { schema: listContentItemsHttpRouteSchema },
    async (request) => {
      const query = parseHttpInput(
        ListContentItemsHttpQuerySchema,
        request.query,
      );
      const input = {
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.sourceGroupId !== undefined
          ? { sourceGroupId: query.sourceGroupId }
          : {}),
        limit: query.limit,
        offset: query.offset,
      } satisfies ListContentItemsInput;
      const output = await contentManager.listContentItems.execute(input);

      return {
        items: output.items.map(toContentItemDto),
        page: output.page,
      };
    },
  );

  server.get(
    "/collector/content-items/:contentItemId",
    { schema: getContentItemHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ContentItemIdHttpParamsSchema,
        request.params,
      );
      const contentItem = await contentManager.getContentItem.execute({
        contentId: params.contentItemId,
      });

      return {
        contentItem: toContentItemDto(contentItem),
      };
    },
  );

  server.patch(
    "/collector/content-items/:contentItemId/status",
    { schema: updateContentStatusHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        ContentItemIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        UpdateContentStatusHttpBodySchema,
        request.body,
      );
      const contentItem = await contentManager.updateContentStatus.execute({
        contentId: params.contentItemId,
        status: body.status,
      });

      return {
        contentItem: toContentItemDto(contentItem),
      };
    },
  );
}

export function toContentCategoryDto(
  category: ContentCategory,
): ContentCategoryDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    ...(category.description !== undefined
      ? { description: category.description }
      : {}),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export function toSourceGroupDto(sourceGroup: SourceGroup): SourceGroupDto {
  return {
    id: sourceGroup.id,
    platform: sourceGroup.platform,
    externalGroupId: sourceGroup.externalGroupId,
    name: sourceGroup.name,
    url: sourceGroup.url,
    categoryId: sourceGroup.categoryId,
    status: sourceGroup.status,
    collectionPriority: sourceGroup.collectionPriority,
    ...(sourceGroup.notes !== undefined ? { notes: sourceGroup.notes } : {}),
    entryRoutes: resolveSourceGroupEntryRoutes(sourceGroup).map(
      toSourceGroupEntryRouteDto,
    ),
    createdAt: sourceGroup.createdAt,
    updatedAt: sourceGroup.updatedAt,
  };
}

function toSourceGroupEntryRouteDto(
  route: SourceGroupEntryRoute,
): SourceGroupEntryRouteDto {
  return {
    id: route.id,
    type: route.type,
    url: route.url,
    ...(route.label !== undefined ? { label: route.label } : {}),
    ...(route.notes !== undefined ? { notes: route.notes } : {}),
    riskLevel: route.riskLevel,
    isDefault: route.isDefault,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
  };
}

export function toContentItemDto(contentItem: ContentItem): ContentItemDto {
  return {
    id: contentItem.id,
    platform: contentItem.platform,
    sourceGroupId: contentItem.sourceGroupId,
    externalPostId: contentItem.externalPostId,
    sourceUrl: contentItem.sourceUrl,
    ...(contentItem.title !== undefined ? { title: contentItem.title } : {}),
    bodyText: contentItem.bodyText,
    ...(contentItem.authorDisplayName !== undefined
      ? { authorDisplayName: contentItem.authorDisplayName }
      : {}),
    ...(contentItem.authorExternalId !== undefined
      ? { authorExternalId: contentItem.authorExternalId }
      : {}),
    ...(contentItem.postedAt !== undefined
      ? { postedAt: contentItem.postedAt }
      : {}),
    firstCollectedAt: contentItem.firstCollectedAt,
    lastCollectedAt: contentItem.lastCollectedAt,
    reactionCount: contentItem.reactionCount,
    commentCount: contentItem.commentCount,
    ...(contentItem.shareCount !== undefined
      ? { shareCount: contentItem.shareCount }
      : {}),
    topComments: contentItem.topComments.map(toTopCommentDto),
    status: contentItem.status,
    createdAt: contentItem.createdAt,
    updatedAt: contentItem.updatedAt,
  };
}

function toTopCommentDto(comment: TopComment): TopCommentDto {
  return {
    externalCommentId: comment.externalCommentId,
    bodyText: comment.bodyText,
    ...(comment.authorDisplayName !== undefined
      ? { authorDisplayName: comment.authorDisplayName }
      : {}),
    ...(comment.authorExternalId !== undefined
      ? { authorExternalId: comment.authorExternalId }
      : {}),
    reactionCount: comment.reactionCount,
    ...(comment.replyCount !== undefined ? { replyCount: comment.replyCount } : {}),
    ...(comment.postedAt !== undefined ? { postedAt: comment.postedAt } : {}),
    collectedAt: comment.collectedAt,
  };
}
