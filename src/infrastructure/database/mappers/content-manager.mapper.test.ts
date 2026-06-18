import { describe, expect, it } from "vitest";
import type { SourcePublisherRow } from "./content-manager.mapper";
import {
  InvalidPersistedContentManagerRecordError,
  toSourcePublisherDomain,
  toSourcePublisherRow,
} from "./content-manager.mapper";
import type { IsoDateTime, SourcePublisher } from "../../../content-manager/domain";

const baseObservedAt = "2026-03-01T08:00:00.000Z";
const baseUpdatedAt = "2026-03-01T08:05:00.000Z";

function makeRow(overrides: Partial<SourcePublisherRow> = {}): SourcePublisherRow {
  const base: SourcePublisherRow = {
    id: "publisher-1",
    platform: "FACEBOOK",
    kind: "GROUP",
    externalPublisherId: "facebook-group-1",
    displayName: "Knowledge Group 1",
    canonicalUrl: "https://www.facebook.com/groups/knowledge-1",
    status: "DISCOVERED",
    firstObservedAt: baseObservedAt,
    lastObservedAt: baseObservedAt,
    observationCount: 1,
    createdAt: baseUpdatedAt,
    updatedAt: baseUpdatedAt,
  };
  return { ...base, ...overrides };
}

function makeDomain(overrides: Partial<SourcePublisher> = {}): SourcePublisher {
  const base: SourcePublisher = {
    id: "publisher-1",
    platform: "FACEBOOK",
    kind: "GROUP",
    externalPublisherId: "facebook-group-1",
    status: "DISCOVERED",
    firstObservedAt: baseObservedAt,
    lastObservedAt: baseObservedAt,
    observationCount: 1,
    createdAt: baseUpdatedAt,
    updatedAt: baseUpdatedAt,
  };
  return { ...base, ...overrides };
}

describe("content-manager mapper — source publisher", () => {
  it("round-trips a complete aggregate", () => {
    const aggregate: SourcePublisher = makeDomain({
      displayName: "Knowledge Group 1",
      canonicalUrl: "https://www.facebook.com/groups/knowledge-1",
    });
    const row = toSourcePublisherRow(aggregate);
    const persistedRow: SourcePublisherRow = {
      id: row.id,
      platform: row.platform,
      kind: row.kind,
      externalPublisherId: row.externalPublisherId,
      displayName: row.displayName ?? null,
      canonicalUrl: row.canonicalUrl ?? null,
      status: row.status,
      firstObservedAt: row.firstObservedAt,
      lastObservedAt: row.lastObservedAt,
      observationCount: row.observationCount,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
    };
    const back: SourcePublisher = toSourcePublisherDomain(persistedRow);
    expect(back).toEqual(aggregate);
  });

  it("maps omitted displayName to PostgreSQL null", () => {
    const row = toSourcePublisherRow(makeDomain());
    expect(row.displayName).toBeNull();
  });

  it("maps omitted canonicalUrl to PostgreSQL null", () => {
    const row = toSourcePublisherRow(makeDomain());
    expect(row.canonicalUrl).toBeNull();
  });

  it("converts PostgreSQL null displayName to an omitted domain property", () => {
    const domain = toSourcePublisherDomain(makeRow({ displayName: null }));
    expect(domain.displayName).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(domain, "displayName")).toBe(
      false,
    );
  });

  it("converts PostgreSQL null canonicalUrl to an omitted domain property", () => {
    const domain = toSourcePublisherDomain(makeRow({ canonicalUrl: null }));
    expect(domain.canonicalUrl).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(domain, "canonicalUrl")).toBe(
      false,
    );
  });

  it("never returns displayName or canonicalUrl as null", () => {
    const row = makeRow({ displayName: null, canonicalUrl: null });
    const domain = toSourcePublisherDomain(row);
    expect(domain.displayName).not.toBeNull();
    expect(domain.canonicalUrl).not.toBeNull();
  });

  it("normalizes Date timestamps into canonical ISO datetime strings", () => {
    const domain = toSourcePublisherDomain(
      makeRow({
        firstObservedAt: new Date("2026-03-01T08:00:00.000Z") as unknown as IsoDateTime,
        lastObservedAt: new Date("2026-03-01T09:00:00.000Z") as unknown as IsoDateTime,
        createdAt: new Date("2026-03-01T07:55:00.000Z") as unknown as IsoDateTime,
        updatedAt: new Date("2026-03-01T09:05:00.000Z") as unknown as IsoDateTime,
      }),
    );
    expect(domain.firstObservedAt).toBe(baseObservedAt);
    expect(domain.lastObservedAt).toBe("2026-03-01T09:00:00.000Z");
    expect(domain.createdAt).toBe("2026-03-01T07:55:00.000Z");
    expect(domain.updatedAt).toBe("2026-03-01T09:05:00.000Z");
  });

  it("rejects an invalid observationCount on the domain side", () => {
    expect(() =>
      toSourcePublisherRow(
        makeDomain({ observationCount: 0 as unknown as number }),
      ),
    ).toThrow(InvalidPersistedContentManagerRecordError);
  });

  it("rejects firstObservedAt later than lastObservedAt on the domain side", () => {
    expect(() =>
      toSourcePublisherDomain(
        makeRow({
          firstObservedAt: "2026-03-01T09:00:00.000Z",
          lastObservedAt: "2026-03-01T08:00:00.000Z",
        }),
      ),
    ).toThrow(InvalidPersistedContentManagerRecordError);
  });

  it("rejects an invalid status enum on the domain side", () => {
    expect(() =>
      toSourcePublisherDomain(
        makeRow({ status: "INVALID" as unknown as SourcePublisher["status"] }),
      ),
    ).toThrow(InvalidPersistedContentManagerRecordError);
  });

  it("rejects an invalid kind enum on the domain side", () => {
    expect(() =>
      toSourcePublisherDomain(
        makeRow({ kind: "INVALID" as unknown as SourcePublisher["kind"] }),
      ),
    ).toThrow(InvalidPersistedContentManagerRecordError);
  });

  it("reports the source publisher recordType in the mapper error", () => {
    try {
      toSourcePublisherRow(
        makeDomain({ observationCount: 0 as unknown as number }),
      );
      throw new Error("expected mapper error to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPersistedContentManagerRecordError);
      const typed = error as InvalidPersistedContentManagerRecordError;
      expect(typed.recordType).toBe("source publisher");
      expect(typed.recordId).toBe("publisher-1");
      expect(typed.issues.length).toBeGreaterThan(0);
    }
  });
});
