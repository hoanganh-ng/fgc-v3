import type {
  TransformType,
  TransformTypeId,
} from "../../domain";
import type {
  TransformTypeListQuery,
  TransformTypeListResult,
  TransformTypeRepository,
} from "../ports/transform-type-repository.port";

export class InMemoryTransformTypeRepository
  implements TransformTypeRepository
{
  private readonly transformTypes = new Map<TransformTypeId, TransformType>();

  public async save(transformType: TransformType): Promise<void> {
    this.transformTypes.set(transformType.transformTypeId, transformType);
  }

  public async findById(
    transformTypeId: TransformTypeId,
  ): Promise<TransformType | null> {
    return this.transformTypes.get(transformTypeId) ?? null;
  }

  public async findActiveByNormalizedName(
    normalizedName: string,
  ): Promise<TransformType | null> {
    for (const transformType of this.transformTypes.values()) {
      if (
        transformType.status === "ACTIVE" &&
        transformType.normalizedName === normalizedName
      ) {
        return transformType;
      }
    }

    return null;
  }

  public async list(
    query: TransformTypeListQuery,
  ): Promise<TransformTypeListResult> {
    const matchingTransformTypes = [...this.transformTypes.values()]
      .filter(
        (transformType) =>
          query.status === undefined || transformType.status === query.status,
      )
      .sort(compareTransformTypesByCreatedAt);

    return {
      items: matchingTransformTypes.slice(
        query.offset,
        query.offset + query.limit,
      ),
      total: matchingTransformTypes.length,
    };
  }
}

function compareTransformTypesByCreatedAt(
  left: TransformType,
  right: TransformType,
): number {
  const createdAtComparison = left.createdAt.localeCompare(right.createdAt);

  return createdAtComparison === 0
    ? left.transformTypeId.localeCompare(right.transformTypeId)
    : createdAtComparison;
}
