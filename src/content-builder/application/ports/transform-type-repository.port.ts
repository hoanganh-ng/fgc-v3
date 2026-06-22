import type {
  TransformType,
  TransformTypeId,
  TransformTypeStatus,
} from "../../domain";

export interface TransformTypeListQuery {
  readonly status?: TransformTypeStatus;
  readonly limit: number;
  readonly offset: number;
}

export interface TransformTypeListResult {
  readonly items: readonly TransformType[];
  readonly total?: number;
}

export interface TransformTypeRepository {
  save(transformType: TransformType): Promise<void>;
  findById(transformTypeId: TransformTypeId): Promise<TransformType | null>;
  findActiveByNormalizedName(
    normalizedName: string,
  ): Promise<TransformType | null>;
  list(query: TransformTypeListQuery): Promise<TransformTypeListResult>;
}
