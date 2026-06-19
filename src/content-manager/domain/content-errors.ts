import type { ContentStatus } from "./content-status";
import type { SourcePublisherIdentity } from "./source-publisher";

export type ContentManagerDomainErrorCode =
  | "INVALID_CONTENT_STATUS_TRANSITION"
  | "SOURCE_PUBLISHER_IDENTITY_MISMATCH"
  | "CONTENT_COLLECTION_PROVENANCE_CONFLICT";

export abstract class ContentManagerDomainError extends Error {
  public readonly code: ContentManagerDomainErrorCode;

  protected constructor(code: ContentManagerDomainErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidContentStatusTransitionError extends ContentManagerDomainError {
  public readonly from: ContentStatus;
  public readonly to: ContentStatus;

  public constructor(from: ContentStatus, to: ContentStatus) {
    super(
      "INVALID_CONTENT_STATUS_TRANSITION",
      `Invalid content status transition: ${from} -> ${to}.`,
    );
    this.from = from;
    this.to = to;
  }
}

export class SourcePublisherIdentityMismatchError extends ContentManagerDomainError {
  public readonly existing: SourcePublisherIdentity;
  public readonly incoming: SourcePublisherIdentity;

  public constructor(
    existing: SourcePublisherIdentity,
    incoming: SourcePublisherIdentity,
  ) {
    super(
      "SOURCE_PUBLISHER_IDENTITY_MISMATCH",
      `Source publisher identity mismatch: existing=${existing.platform}/${existing.kind}/${existing.externalPublisherId} incoming=${incoming.platform}/${incoming.kind}/${incoming.externalPublisherId}.`,
    );
    this.existing = existing;
    this.incoming = incoming;
  }
}

export type ContentCollectionProvenanceConflictField =
  | "sourcePublisherId"
  | "managedSourceGroupId";

export class ContentCollectionProvenanceConflictError extends ContentManagerDomainError {
  public readonly field: ContentCollectionProvenanceConflictField;
  public readonly existing: string;
  public readonly incoming: string;

  public constructor(
    field: ContentCollectionProvenanceConflictField,
    existing: string,
    incoming: string,
  ) {
    super(
      "CONTENT_COLLECTION_PROVENANCE_CONFLICT",
      `Content collection provenance conflict on ${field}: existing=${existing} incoming=${incoming}.`,
    );
    this.field = field;
    this.existing = existing;
    this.incoming = incoming;
  }
}
