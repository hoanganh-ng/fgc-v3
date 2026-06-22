import {
  assertUniqueActiveName,
  validateRequiredTransformTypeInputText,
} from "./create-transform-type.use-case";
import {
  loadValidatedTransformTypeById,
  toIsoDateTime,
  validateTransformTypeForApplication,
} from "../transform-type-validation";
import type { Clock } from "../ports/clock.port";
import type { TransformTypeRepository } from "../ports/transform-type-repository.port";
import {
  normalizeTransformTypeName,
  updateTransformType,
  type TransformType,
  type TransformTypeId,
} from "../../domain";

export interface UpdateTransformTypeInput {
  readonly transformTypeId: TransformTypeId;
  readonly name?: string;
  readonly description?: string;
  readonly clearDescription?: boolean;
  readonly initialPrompt?: string;
}

export class UpdateTransformTypeUseCase {
  public constructor(
    private readonly transformTypes: TransformTypeRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: UpdateTransformTypeInput,
  ): Promise<TransformType> {
    validateRequiredTransformTypeInputText("name", input.name);
    validateRequiredTransformTypeInputText(
      "initialPrompt",
      input.initialPrompt,
    );
    const existing = await loadValidatedTransformTypeById(
      this.transformTypes,
      input.transformTypeId,
    );
    const nextName =
      input.name === undefined ? existing.name : input.name;

    if (existing.status === "ACTIVE") {
      await assertUniqueActiveName(
        this.transformTypes,
        normalizeTransformTypeName(nextName),
        existing.transformTypeId,
      );
    }

    const next = validateTransformTypeForApplication(
      updateTransformType(existing, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.clearDescription !== undefined
          ? { clearDescription: input.clearDescription }
          : {}),
        ...(input.initialPrompt !== undefined
          ? { initialPrompt: input.initialPrompt }
          : {}),
        updatedAt: toIsoDateTime(this.clock.now()),
      }),
    );
    await this.transformTypes.save(next);

    return next;
  }
}
