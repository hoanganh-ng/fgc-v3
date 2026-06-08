import type { ContentStatus } from "./content-status";

export type ContentManagerDomainErrorCode =
  "INVALID_CONTENT_STATUS_TRANSITION";

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
