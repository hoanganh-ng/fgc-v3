import type {
  ContentPlatform,
  ContentStatus,
  ValidationIssue,
} from "../domain";

export type ContentManagerApplicationErrorCode =
  | "CONTENT_CATEGORY_ALREADY_EXISTS"
  | "CONTENT_CATEGORY_NOT_FOUND"
  | "SOURCE_GROUP_ALREADY_EXISTS"
  | "SOURCE_GROUP_NOT_FOUND"
  | "SOURCE_GROUP_ENTRY_ROUTE_NOT_FOUND"
  | "CONTENT_ITEM_NOT_FOUND"
  | "INVALID_CONTENT_STATUS_TRANSITION"
  | "CONTENT_VALIDATION_ERROR";

export abstract class ContentManagerApplicationError extends Error {
  public readonly code: ContentManagerApplicationErrorCode;

  protected constructor(
    code: ContentManagerApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ContentCategoryAlreadyExistsError extends ContentManagerApplicationError {
  public readonly field: string;
  public readonly value: string;

  public constructor(field: string, value: string) {
    super(
      "CONTENT_CATEGORY_ALREADY_EXISTS",
      `Content category already exists for ${field}: ${value}.`,
    );
    this.field = field;
    this.value = value;
  }
}

export class ContentCategoryNotFoundError extends ContentManagerApplicationError {
  public readonly categoryId: string;

  public constructor(categoryId: string) {
    super(
      "CONTENT_CATEGORY_NOT_FOUND",
      `Content category not found: ${categoryId}.`,
    );
    this.categoryId = categoryId;
  }
}

export class SourceGroupAlreadyExistsError extends ContentManagerApplicationError {
  public readonly platform: ContentPlatform;
  public readonly externalGroupId: string;

  public constructor(platform: ContentPlatform, externalGroupId: string) {
    super(
      "SOURCE_GROUP_ALREADY_EXISTS",
      `Source group already exists for ${platform}:${externalGroupId}.`,
    );
    this.platform = platform;
    this.externalGroupId = externalGroupId;
  }
}

export class SourceGroupNotFoundError extends ContentManagerApplicationError {
  public readonly sourceGroupId: string;

  public constructor(sourceGroupId: string) {
    super("SOURCE_GROUP_NOT_FOUND", `Source group not found: ${sourceGroupId}.`);
    this.sourceGroupId = sourceGroupId;
  }
}

export class SourceGroupEntryRouteNotFoundError extends ContentManagerApplicationError {
  public readonly sourceGroupId: string;
  public readonly entryRouteId: string;

  public constructor(sourceGroupId: string, entryRouteId: string) {
    super(
      "SOURCE_GROUP_ENTRY_ROUTE_NOT_FOUND",
      `Source group entry route not found: ${sourceGroupId}/${entryRouteId}.`,
    );
    this.sourceGroupId = sourceGroupId;
    this.entryRouteId = entryRouteId;
  }
}

export class ContentItemNotFoundError extends ContentManagerApplicationError {
  public readonly contentId: string;

  public constructor(contentId: string) {
    super("CONTENT_ITEM_NOT_FOUND", `Content item not found: ${contentId}.`);
    this.contentId = contentId;
  }
}

export class InvalidContentStatusTransitionError extends ContentManagerApplicationError {
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

export class ContentValidationError extends ContentManagerApplicationError {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super("CONTENT_VALIDATION_ERROR", "Content Manager input is invalid.");
    this.issues = issues;
  }
}
