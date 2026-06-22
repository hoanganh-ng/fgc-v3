import {
  TransformTypeNameAlreadyExistsError,
  TransformTypeValidationError,
} from "../application-errors";
import { toIsoDateTime, validateTransformTypeForApplication } from "../transform-type-validation";
import type { Clock } from "../ports/clock.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { TransformTypeRepository } from "../ports/transform-type-repository.port";
import {
  createTransformType,
  normalizeTransformTypeName,
  type TransformType,
} from "../../domain";

export interface CreateTransformTypeInput {
  readonly name: string;
  readonly description?: string;
  readonly initialPrompt: string;
}

export class CreateTransformTypeUseCase {
  public constructor(
    private readonly transformTypes: TransformTypeRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: CreateTransformTypeInput,
  ): Promise<TransformType> {
    const now = toIsoDateTime(this.clock.now());
    const candidate = createTransformType({
      transformTypeId: await this.ids.generateId(),
      name: input.name,
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      initialPrompt: input.initialPrompt,
      createdAt: now,
      updatedAt: now,
    });
    const transformType = validateTransformTypeForApplication(candidate);
    await assertUniqueActiveName(
      this.transformTypes,
      transformType.normalizedName,
    );
    await this.transformTypes.save(transformType);

    return transformType;
  }
}

export async function assertUniqueActiveName(
  transformTypes: TransformTypeRepository,
  normalizedName: string,
  currentTransformTypeId?: string,
): Promise<void> {
  const existing =
    await transformTypes.findActiveByNormalizedName(normalizedName);

  if (
    existing !== null &&
    existing.transformTypeId !== currentTransformTypeId
  ) {
    throw new TransformTypeNameAlreadyExistsError(normalizedName);
  }
}

export function validateRequiredTransformTypeInputText(
  field: string,
  value: string | undefined,
): void {
  if (value !== undefined && value.trim().length === 0) {
    throw new TransformTypeValidationError([
      { path: field, message: "Expected non-empty string." },
    ]);
  }
}

export function normalizeTransformTypeInputName(name: string): string {
  return normalizeTransformTypeName(name);
}
