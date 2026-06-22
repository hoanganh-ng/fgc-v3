import {
  loadValidatedTransformTypeById,
  toIsoDateTime,
  validateTransformTypeForApplication,
} from "../transform-type-validation";
import type { Clock } from "../ports/clock.port";
import type { TransformTypeRepository } from "../ports/transform-type-repository.port";
import {
  archiveTransformType,
  type TransformType,
  type TransformTypeId,
} from "../../domain";

export interface ArchiveTransformTypeInput {
  readonly transformTypeId: TransformTypeId;
}

export class ArchiveTransformTypeUseCase {
  public constructor(
    private readonly transformTypes: TransformTypeRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: ArchiveTransformTypeInput,
  ): Promise<TransformType> {
    const existing = await loadValidatedTransformTypeById(
      this.transformTypes,
      input.transformTypeId,
    );
    const next = validateTransformTypeForApplication(
      archiveTransformType(existing, toIsoDateTime(this.clock.now())),
    );
    await this.transformTypes.save(next);

    return next;
  }
}
