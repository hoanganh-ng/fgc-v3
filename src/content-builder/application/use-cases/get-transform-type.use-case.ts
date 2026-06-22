import { loadValidatedTransformTypeById } from "../transform-type-validation";
import type { TransformTypeRepository } from "../ports/transform-type-repository.port";
import type { TransformType, TransformTypeId } from "../../domain";

export interface GetTransformTypeInput {
  readonly transformTypeId: TransformTypeId;
}

export class GetTransformTypeUseCase {
  public constructor(
    private readonly transformTypes: TransformTypeRepository,
  ) {}

  public async execute(input: GetTransformTypeInput): Promise<TransformType> {
    return loadValidatedTransformTypeById(
      this.transformTypes,
      input.transformTypeId,
    );
  }
}
