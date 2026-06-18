import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type {
  AtomicSourcePublisherObservationInput,
  SourcePublisherListQuery,
  SourcePublisherListResult,
  SourcePublisherRepository,
  SourcePublisherStatusPersistenceInput,
} from "../../../content-manager/application";
import {
  observeSourcePublisher,
  type ContentPlatform,
  type ExternalPublisherId,
  type SourcePublisher,
  type SourcePublisherId,
  type SourcePublisherKind,
} from "../../../content-manager/domain";
import type { Database, DatabaseSession } from "../client";
import {
  toSourcePublisherDomain,
  toSourcePublisherRow,
  type SourcePublisherRow,
} from "../mappers/content-manager.mapper";
import { sourcePublishers } from "../schema/content-manager.schema";

export class DrizzleSourcePublisherRepository
  implements SourcePublisherRepository
{
  public constructor(private readonly db: Database) {}

  public async observeAtomically(
    input: AtomicSourcePublisherObservationInput,
  ): Promise<SourcePublisher> {
    return this.db.transaction(async (tx) => observeWithinTransaction(tx, input));
  }

  public async updateStatus(
    input: SourcePublisherStatusPersistenceInput,
  ): Promise<SourcePublisher | null> {
    const [row] = await this.db
      .update(sourcePublishers)
      .set({ status: input.status, updatedAt: input.updatedAt })
      .where(eq(sourcePublishers.id, input.sourcePublisherId))
      .returning();

    return row === undefined ? null : toSourcePublisherDomain(row);
  }

  public async findById(
    id: SourcePublisherId,
  ): Promise<SourcePublisher | null> {
    const [row] = await this.db
      .select()
      .from(sourcePublishers)
      .where(eq(sourcePublishers.id, id))
      .limit(1);

    return row === undefined ? null : toSourcePublisherDomain(row);
  }

  public async findByIdentity(
    platform: ContentPlatform,
    kind: SourcePublisherKind,
    externalPublisherId: ExternalPublisherId,
  ): Promise<SourcePublisher | null> {
    const [row] = await this.db
      .select()
      .from(sourcePublishers)
      .where(
        and(
          eq(sourcePublishers.platform, platform),
          eq(sourcePublishers.kind, kind),
          eq(sourcePublishers.externalPublisherId, externalPublisherId),
        ),
      )
      .limit(1);

    return row === undefined ? null : toSourcePublisherDomain(row);
  }

  public async list(
    query: SourcePublisherListQuery,
  ): Promise<SourcePublisherListResult> {
    const where = getSourcePublisherListWhere(query);
    const rows = await this.db
      .select()
      .from(sourcePublishers)
      .where(where)
      .orderBy(desc(sourcePublishers.lastObservedAt), asc(sourcePublishers.id))
      .limit(query.limit)
      .offset(query.offset);
    const [totalRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(sourcePublishers)
      .where(where);

    return {
      items: rows.map((row) => toSourcePublisherDomain(row)),
      total: Number(totalRow?.total ?? 0),
    };
  }
}

async function observeWithinTransaction(
  tx: DatabaseSession,
  input: AtomicSourcePublisherObservationInput,
): Promise<SourcePublisher> {
  const initial = observeSourcePublisher(null, {
    id: input.candidateId,
    identity: {
      platform: input.platform,
      kind: input.kind,
      externalPublisherId: input.externalPublisherId,
    },
    observedAt: input.observedAt,
    ...(input.displayName !== undefined
      ? { displayName: input.displayName }
      : {}),
    ...(input.canonicalUrl !== undefined
      ? { canonicalUrl: input.canonicalUrl }
      : {}),
  }, { updatedAt: input.updatedAt });
  const initialRow = toSourcePublisherRow(initial);

  const inserted = await tx
    .insert(sourcePublishers)
    .values(initialRow)
    .onConflictDoNothing({
      target: [
        sourcePublishers.platform,
        sourcePublishers.kind,
        sourcePublishers.externalPublisherId,
      ],
    })
    .returning();

  if (inserted.length > 0) {
    return toSourcePublisherDomain(inserted[0]!);
  }

  const lockedRowsResult = await tx.execute<SourcePublisherRow>(sql`
    SELECT
      id AS "id",
      platform AS "platform",
      kind AS "kind",
      external_publisher_id AS "externalPublisherId",
      display_name AS "displayName",
      canonical_url AS "canonicalUrl",
      status AS "status",
      first_observed_at AS "firstObservedAt",
      last_observed_at AS "lastObservedAt",
      observation_count AS "observationCount",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM source_publishers
    WHERE platform = ${input.platform}
      AND kind = ${input.kind}
      AND external_publisher_id = ${input.externalPublisherId}
    FOR UPDATE
  `);
  const [lockedRow] = lockedRowsResult.rows ?? [];

  if (lockedRow === undefined) {
    throw new SourcePublisherRowVanishedError(input);
  }

  const existing = toSourcePublisherDomain(lockedRow);
  const next = observeSourcePublisher(
    existing,
    {
      id: existing.id,
      identity: {
        platform: input.platform,
        kind: input.kind,
        externalPublisherId: input.externalPublisherId,
      },
      observedAt: input.observedAt,
      ...(input.displayName !== undefined
        ? { displayName: input.displayName }
        : {}),
      ...(input.canonicalUrl !== undefined
        ? { canonicalUrl: input.canonicalUrl }
        : {}),
    },
    { updatedAt: input.updatedAt },
  );

  const [updated] = await tx
    .update(sourcePublishers)
    .set({
      displayName: next.displayName ?? null,
      canonicalUrl: next.canonicalUrl ?? null,
      lastObservedAt: next.lastObservedAt,
      observationCount: next.observationCount,
      updatedAt: next.updatedAt,
    })
    .where(eq(sourcePublishers.id, next.id))
    .returning();

  if (updated === undefined) {
    throw new SourcePublisherRowVanishedError(input);
  }

  return toSourcePublisherDomain(updated);
}

function getSourcePublisherListWhere(
  query: SourcePublisherListQuery,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (query.status !== undefined) {
    conditions.push(eq(sourcePublishers.status, query.status));
  }

  if (query.kind !== undefined) {
    conditions.push(eq(sourcePublishers.kind, query.kind));
  }

  if (query.platform !== undefined) {
    conditions.push(eq(sourcePublishers.platform, query.platform));
  }

  return conditions.length === 0 ? undefined : and(...conditions);
}

export class SourcePublisherRowVanishedError extends Error {
  public readonly identity: {
    readonly platform: ContentPlatform;
    readonly kind: SourcePublisherKind;
    readonly externalPublisherId: ExternalPublisherId;
  };

  public constructor(input: AtomicSourcePublisherObservationInput) {
    super(
      `Source publisher row vanished during atomic observation for ${input.platform}/${input.kind}/${input.externalPublisherId}.`,
    );
    this.name = "SourcePublisherRowVanishedError";
    this.identity = {
      platform: input.platform,
      kind: input.kind,
      externalPublisherId: input.externalPublisherId,
    };
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
