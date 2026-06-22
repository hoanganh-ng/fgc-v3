import type { TransformTypeStatus } from "./transform-type-status";

export type TransformTypeId = string;
export type IsoDateTime = string;

export interface TransformType {
  readonly transformTypeId: TransformTypeId;
  readonly name: string;
  readonly normalizedName: string;
  readonly description?: string;
  readonly initialPrompt: string;
  readonly status: TransformTypeStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CreateTransformTypeDomainInput {
  readonly transformTypeId: TransformTypeId;
  readonly name: string;
  readonly description?: string;
  readonly initialPrompt: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface UpdateTransformTypeDomainInput {
  readonly name?: string;
  readonly description?: string;
  readonly clearDescription?: boolean;
  readonly initialPrompt?: string;
  readonly updatedAt: IsoDateTime;
}

export function createTransformType(
  input: CreateTransformTypeDomainInput,
): TransformType {
  const name = normalizeRequiredText(input.name);
  const initialPrompt = normalizeRequiredText(input.initialPrompt);

  return {
    transformTypeId: input.transformTypeId,
    name,
    normalizedName: normalizeTransformTypeName(name),
    ...optionalText("description", input.description),
    initialPrompt,
    status: "ACTIVE",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function updateTransformType(
  transformType: TransformType,
  input: UpdateTransformTypeDomainInput,
): TransformType {
  const name =
    input.name === undefined
      ? transformType.name
      : normalizeRequiredText(input.name);
  const initialPrompt =
    input.initialPrompt === undefined
      ? transformType.initialPrompt
      : normalizeRequiredText(input.initialPrompt);
  const description =
    input.clearDescription === true
      ? undefined
      : input.description === undefined
        ? transformType.description
        : normalizeOptionalText(input.description);

  return {
    transformTypeId: transformType.transformTypeId,
    name,
    normalizedName: normalizeTransformTypeName(name),
    ...(description !== undefined ? { description } : {}),
    initialPrompt,
    status: transformType.status,
    createdAt: transformType.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function archiveTransformType(
  transformType: TransformType,
  updatedAt: IsoDateTime,
): TransformType {
  return {
    ...transformType,
    status: "ARCHIVED",
    updatedAt,
  };
}

export function normalizeTransformTypeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function normalizeRequiredText(value: string): string {
  return value.trim();
}

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();

  return trimmed.length === 0 ? undefined : trimmed;
}

function optionalText(
  key: "description",
  value: string | undefined,
): Pick<TransformType, "description"> | Record<string, never> {
  if (value === undefined) {
    return {};
  }

  const normalized = normalizeOptionalText(value);

  return normalized === undefined ? {} : { [key]: normalized };
}
