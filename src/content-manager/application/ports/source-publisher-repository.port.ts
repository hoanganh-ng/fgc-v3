import type {
  ContentPlatform,
  ExternalPublisherId,
  SourcePublisher,
  SourcePublisherId,
  SourcePublisherKind,
  SourcePublisherStatus,
} from "../../domain";

export interface SourcePublisherListQuery {
  readonly status?: SourcePublisherStatus;
  readonly kind?: SourcePublisherKind;
  readonly platform?: ContentPlatform;
  readonly limit: number;
  readonly offset: number;
}

export interface SourcePublisherListResult {
  readonly items: readonly SourcePublisher[];
  readonly total?: number;
}

export interface SourcePublisherRepository {
  save(sourcePublisher: SourcePublisher): Promise<void>;
  findById(id: SourcePublisherId): Promise<SourcePublisher | null>;
  findByIdentity(
    platform: ContentPlatform,
    kind: SourcePublisherKind,
    externalPublisherId: ExternalPublisherId,
  ): Promise<SourcePublisher | null>;
  list(query: SourcePublisherListQuery): Promise<SourcePublisherListResult>;
}
