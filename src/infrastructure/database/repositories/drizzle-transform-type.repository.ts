import { and, asc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type {
  TransformTypeListQuery,
  TransformTypeListResult,
  TransformTypeRepository,
} from "../../../content-builder/application";
import { TransformTypeNameAlreadyExistsError } from "../../../content-builder/application";
import type {
  TransformType,
  TransformTypeId,
} from "../../../content-builder/domain";
import type { Database } from "../client";
import {
  toTransformTypeDomain,
  toTransformTypeRow,
} from "../mappers/content-builder.mapper";
import { contentBuilderTransformTypes } from "../schema/content-builder.schema";

export class DrizzleTransformTypeRepository
  implements TransformTypeRepository
{
  public constructor(private readonly db: Database) {}

  public async save(transformType: TransformType): Promise<void> {
    const row = toTransformTypeRow(transformType);

    try {
      await this.db
        .insert(contentBuilderTransformTypes)
        .values(row)
        .onConflictDoUpdate({
          target: contentBuilderTransformTypes.transformTypeId,
          set: {
            name: row.name,
            normalizedName: row.normalizedName,
            description: row.description,
            initialPrompt: row.initialPrompt,
            status: row.status,
            updatedAt: row.updatedAt,
          },
        });
    } catch (error: unknown) {
      if (isActiveNameUniqueConflict(error)) {
        throw new TransformTypeNameAlreadyExistsError(row.normalizedName);
      }

      throw error;
    }
  }

  public async findById(
    transformTypeId: TransformTypeId,
  ): Promise<TransformType | null> {
    const [row] = await this.db
      .select()
      .from(contentBuilderTransformTypes)
      .where(
        eq(contentBuilderTransformTypes.transformTypeId, transformTypeId),
      )
      .limit(1);

    return row === undefined ? null : toTransformTypeDomain(row);
  }

  public async findActiveByNormalizedName(
    normalizedName: string,
  ): Promise<TransformType | null> {
    const [row] = await this.db
      .select()
      .from(contentBuilderTransformTypes)
      .where(
        and(
          eq(contentBuilderTransformTypes.normalizedName, normalizedName),
          eq(contentBuilderTransformTypes.status, "ACTIVE"),
        ),
      )
      .limit(1);

    return row === undefined ? null : toTransformTypeDomain(row);
  }

  public async list(
    query: TransformTypeListQuery,
  ): Promise<TransformTypeListResult> {
    const where = getTransformTypeListWhere(query);
    const rows = await this.db
      .select()
      .from(contentBuilderTransformTypes)
      .where(where)
      .orderBy(
        asc(contentBuilderTransformTypes.createdAt),
        asc(contentBuilderTransformTypes.transformTypeId),
      )
      .limit(query.limit)
      .offset(query.offset);
    const [totalRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(contentBuilderTransformTypes)
      .where(where);

    return {
      items: rows.map((row) => toTransformTypeDomain(row)),
      total: Number(totalRow?.total ?? 0),
    };
  }
}

function getTransformTypeListWhere(
  query: TransformTypeListQuery,
): SQL | undefined {
  if (query.status === undefined) {
    return undefined;
  }

  return eq(contentBuilderTransformTypes.status, query.status);
}

function isActiveNameUniqueConflict(error: unknown): boolean {
  return (
    hasPostgresConstraint(
      error,
      "content_builder_transform_types_active_name_uidx",
    ) ||
    (typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      hasPostgresConstraint(
        error.cause,
        "content_builder_transform_types_active_name_uidx",
      ))
  );
}

function hasPostgresConstraint(error: unknown, constraint: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === constraint
  );
}
