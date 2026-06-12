import type { CollectionRunStatus } from "./collection-run-status";

export type CollectorRuntimeDomainErrorCode =
  "INVALID_COLLECTION_RUN_STATUS_TRANSITION";

export abstract class CollectorRuntimeDomainError extends Error {
  public readonly code: CollectorRuntimeDomainErrorCode;

  protected constructor(code: CollectorRuntimeDomainErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidCollectionRunStatusTransitionError extends CollectorRuntimeDomainError {
  public readonly from: CollectionRunStatus;
  public readonly to: CollectionRunStatus;

  public constructor(from: CollectionRunStatus, to: CollectionRunStatus) {
    super(
      "INVALID_COLLECTION_RUN_STATUS_TRANSITION",
      `Invalid collection run status transition: ${from} -> ${to}.`,
    );
    this.from = from;
    this.to = to;
  }
}
