import type {
  ContentCategoryId,
  ContentPlatform,
  ExternalGroupId,
  SourceGroup,
  SourceGroupId,
  SourceGroupStatus,
} from "../../domain";

export interface SourceGroupListQuery {
  readonly status?: SourceGroupStatus;
  readonly categoryId?: ContentCategoryId;
  readonly limit: number;
  readonly offset: number;
}

export interface SourceGroupListResult {
  readonly items: readonly SourceGroup[];
  readonly total?: number;
}

export interface SourceGroupRepository {
  save(sourceGroup: SourceGroup): Promise<void>;
  findById(id: SourceGroupId): Promise<SourceGroup | null>;
  findByPlatformAndExternalGroupId(
    platform: ContentPlatform,
    externalGroupId: ExternalGroupId,
  ): Promise<SourceGroup | null>;
  list(query: SourceGroupListQuery): Promise<SourceGroupListResult>;
}
