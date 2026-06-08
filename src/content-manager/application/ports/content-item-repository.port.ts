import type {
  ContentId,
  ContentItem,
  ContentPlatform,
  ContentStatus,
  ExternalPostId,
  SourceGroupId,
} from "../../domain";

export interface ContentItemListQuery {
  readonly status?: ContentStatus;
  readonly sourceGroupId?: SourceGroupId;
  readonly limit: number;
  readonly offset: number;
}

export interface ContentItemListResult {
  readonly items: readonly ContentItem[];
  readonly total?: number;
}

export interface ContentItemRepository {
  save(contentItem: ContentItem): Promise<void>;
  findById(id: ContentId): Promise<ContentItem | null>;
  findByPlatformAndExternalPostId(
    platform: ContentPlatform,
    externalPostId: ExternalPostId,
  ): Promise<ContentItem | null>;
  list(query: ContentItemListQuery): Promise<ContentItemListResult>;
}
