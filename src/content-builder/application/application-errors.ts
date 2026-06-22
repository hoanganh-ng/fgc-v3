import type { ValidationIssue } from "../domain";

export type ContentBuilderApplicationErrorCode =
  | "TRANSFORM_TYPE_NOT_FOUND"
  | "TRANSFORM_TYPE_VALIDATION_ERROR"
  | "TRANSFORM_TYPE_NAME_ALREADY_EXISTS";

export abstract class ContentBuilderApplicationError extends Error {
  public readonly code: ContentBuilderApplicationErrorCode;

  protected constructor(
    code: ContentBuilderApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TransformTypeNotFoundError extends ContentBuilderApplicationError {
  public readonly transformTypeId: string;

  public constructor(transformTypeId: string) {
    super(
      "TRANSFORM_TYPE_NOT_FOUND",
      `Transform type not found: ${transformTypeId}.`,
    );
    this.transformTypeId = transformTypeId;
  }
}

export class TransformTypeValidationError extends ContentBuilderApplicationError {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super(
      "TRANSFORM_TYPE_VALIDATION_ERROR",
      "Transform type input is invalid.",
    );
    this.issues = issues;
  }
}

export class TransformTypeNameAlreadyExistsError extends ContentBuilderApplicationError {
  public readonly normalizedName: string;

  public constructor(normalizedName: string) {
    super(
      "TRANSFORM_TYPE_NAME_ALREADY_EXISTS",
      `Active transform type already exists for name: ${normalizedName}.`,
    );
    this.normalizedName = normalizedName;
  }
}
