import type {
  ContentPlatform,
  ExternalPublisherId,
  IsoDateTime,
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

export interface AtomicSourcePublisherObservationInput {
  readonly candidateId: SourcePublisherId;
  readonly platform: ContentPlatform;
  readonly kind: SourcePublisherKind;
  readonly externalPublisherId: ExternalPublisherId;
  readonly observedAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly displayName?: string;
  readonly canonicalUrl?: string;
}

export interface SourcePublisherStatusPersistenceInput {
  readonly sourcePublisherId: SourcePublisherId;
  readonly status: SourcePublisherStatus;
  readonly updatedAt: IsoDateTime;
}

export interface SourcePublisherRepository {
  observeAtomically(
    input: AtomicSourcePublisherObservationInput,
  ): Promise<SourcePublisher>;
  updateStatus(
    input: SourcePublisherStatusPersistenceInput,
  ): Promise<SourcePublisher | null>;
  findById(id: SourcePublisherId): Promise<SourcePublisher | null>;
  findByIdentity(
    platform: ContentPlatform,
    kind: SourcePublisherKind,
    externalPublisherId: ExternalPublisherId,
  ): Promise<SourcePublisher | null>;
  list(query: SourcePublisherListQuery): Promise<SourcePublisherListResult>;
}
