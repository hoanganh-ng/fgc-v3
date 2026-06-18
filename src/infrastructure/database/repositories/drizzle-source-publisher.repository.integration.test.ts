import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type {
  ContentPlatform,
  IsoDateTime,
  SourcePublisher,
} from "../../../content-manager/domain";
import { createDatabaseClient, type DatabaseClient } from "../client";
import { sourcePublishers } from "../schema/content-manager.schema";
import { DrizzleSourcePublisherRepository } from "./drizzle-source-publisher.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip(
    "Content Manager Source Publisher PostgreSQL repository integration",
    () => {
      it("runs only when RUN_DB_TESTS=true", () => {});
    },
  );
} else {
  describe(
    "Content Manager Source Publisher PostgreSQL repository integration",
    () => {
      let client: DatabaseClient | undefined;
      let repository: DrizzleSourcePublisherRepository;
      let counter = 0;
      const trackedIds = new Set<string>();

      beforeAll(() => {
        const databaseClient = createDatabaseClient({
          poolConfig: {
            max: 8,
          },
        });
        client = databaseClient;
        repository = new DrizzleSourcePublisherRepository(databaseClient.db);
      });

      afterEach(async () => {
        if (client === undefined) {
          return;
        }

        if (trackedIds.size > 0) {
          await client.db
            .delete(sourcePublishers)
            .where(inArray(sourcePublishers.id, [...trackedIds]));
          trackedIds.clear();
        }
      });

      afterAll(async () => {
        await client?.close();
      });

      it("inserts and round-trips a source publisher", async () => {
        const seed = makeSeed({
          id: nextId("roundtrip"),
          externalPublisherId: nextId("external-roundtrip"),
        });
        track(seed.id);

        const inserted = await repository.observeAtomically(seed.input);
        expect(inserted.id).toBe(seed.expected.id);
        expect(inserted.displayName).toBe(seed.expected.displayName);
        expect(inserted.canonicalUrl).toBe(seed.expected.canonicalUrl);

        await expect(
          repository.findById(seed.expected.id),
        ).resolves.toEqual(seed.expected);
        await expect(
          repository.findByIdentity(
            seed.expected.platform,
            seed.expected.kind,
            seed.expected.externalPublisherId,
          ),
        ).resolves.toEqual(seed.expected);
      });

      it("omits displayName and canonicalUrl when not provided", async () => {
        const seed = makeSeed({
          id: nextId("optional-metadata"),
          externalPublisherId: nextId("external-optional-metadata"),
        });
        track(seed.id);

        await repository.observeAtomically(seed.input);

        const stored = await repository.findById(seed.id);
        expect(stored).toMatchObject({
          id: seed.id,
          status: "DISCOVERED",
          observationCount: 1,
        });
        expect(Object.prototype.hasOwnProperty.call(stored!, "displayName")).toBe(
          false,
        );
        expect(Object.prototype.hasOwnProperty.call(stored!, "canonicalUrl")).toBe(
          false,
        );
      });

      it("increments observationCount and advances lastObservedAt on a newer observation", async () => {
        const seed = makeSeed({
          id: nextId("newer-observation"),
          externalPublisherId: nextId("external-newer"),
          observedAt: "2026-03-01T08:00:00.000Z",
          updatedAt: "2026-03-01T08:00:00.000Z",
          displayName: "Original Name",
        });
        track(seed.id);

        await repository.observeAtomically(seed.input);

        const second = await repository.observeAtomically({
          candidateId: "candidate-not-used",
          platform: seed.expected.platform,
          kind: seed.expected.kind,
          externalPublisherId: seed.expected.externalPublisherId,
          observedAt: "2026-03-01T09:00:00.000Z",
          updatedAt: "2026-03-01T09:05:00.000Z",
          displayName: "Updated Name",
          canonicalUrl: "https://www.facebook.com/groups/updated",
        });

        expect(second.id).toBe(seed.id);
        expect(second.displayName).toBe("Updated Name");
        expect(second.canonicalUrl).toBe(
          "https://www.facebook.com/groups/updated",
        );
        expect(second.observationCount).toBe(2);
        expect(second.lastObservedAt).toBe("2026-03-01T09:00:00.000Z");
        expect(second.createdAt).toBe(seed.expected.createdAt);
        expect(second.firstObservedAt).toBe(seed.expected.firstObservedAt);
      });

      it("does not replace metadata on an older observation", async () => {
        const seed = makeSeed({
          id: nextId("older-observation"),
          externalPublisherId: nextId("external-older"),
          observedAt: "2026-03-01T09:00:00.000Z",
          updatedAt: "2026-03-01T09:05:00.000Z",
          displayName: "Newer Name",
          canonicalUrl: "https://www.facebook.com/groups/newer",
        });
        track(seed.id);

        await repository.observeAtomically(seed.input);

        const second = await repository.observeAtomically({
          candidateId: "unused-candidate",
          platform: seed.expected.platform,
          kind: seed.expected.kind,
          externalPublisherId: seed.expected.externalPublisherId,
          observedAt: "2026-03-01T07:00:00.000Z",
          updatedAt: "2026-03-01T07:05:00.000Z",
          displayName: "Stale Name",
          canonicalUrl: "https://www.facebook.com/groups/stale",
        });

        expect(second.displayName).toBe("Newer Name");
        expect(second.canonicalUrl).toBe(
          "https://www.facebook.com/groups/newer",
        );
        expect(second.lastObservedAt).toBe("2026-03-01T09:00:00.000Z");
        expect(second.observationCount).toBe(2);
      });

      it("does not clear persisted metadata when observation omits it", async () => {
        const seed = makeSeed({
          id: nextId("omitted-metadata"),
          externalPublisherId: nextId("external-omitted"),
          observedAt: "2026-03-01T09:00:00.000Z",
          updatedAt: "2026-03-01T09:05:00.000Z",
          displayName: "Original Name",
          canonicalUrl: "https://www.facebook.com/groups/original",
        });
        track(seed.id);

        await repository.observeAtomically(seed.input);

        const second = await repository.observeAtomically({
          candidateId: "unused-candidate",
          platform: seed.expected.platform,
          kind: seed.expected.kind,
          externalPublisherId: seed.expected.externalPublisherId,
          observedAt: "2026-03-01T10:00:00.000Z",
          updatedAt: "2026-03-01T10:05:00.000Z",
        });

        expect(second.displayName).toBe("Original Name");
        expect(second.canonicalUrl).toBe(
          "https://www.facebook.com/groups/original",
        );
        expect(second.observationCount).toBe(2);
      });

      it("preserves an existing APPROVED status across observations", async () => {
        const seed = makeSeed({
          id: nextId("status-preserved"),
          externalPublisherId: nextId("external-status-preserved"),
          observedAt: "2026-03-01T08:00:00.000Z",
          updatedAt: "2026-03-01T08:05:00.000Z",
        });
        track(seed.id);

        await repository.observeAtomically(seed.input);

        await repository.updateStatus({
          sourcePublisherId: seed.id,
          status: "APPROVED",
          updatedAt: "2026-03-01T08:10:00.000Z",
        });

        const second = await repository.observeAtomically({
          candidateId: "unused-candidate",
          platform: seed.expected.platform,
          kind: seed.expected.kind,
          externalPublisherId: seed.expected.externalPublisherId,
          observedAt: "2026-03-01T09:00:00.000Z",
          updatedAt: "2026-03-01T09:05:00.000Z",
        });

        expect(second.status).toBe("APPROVED");
        expect(second.observationCount).toBe(2);
      });

      it("updateStatus changes only status and updatedAt", async () => {
        const seed = makeSeed({
          id: nextId("update-status"),
          externalPublisherId: nextId("external-update-status"),
          displayName: "Display",
          canonicalUrl: "https://www.facebook.com/groups/display",
          observedAt: "2026-03-01T08:00:00.000Z",
          updatedAt: "2026-03-01T08:05:00.000Z",
        });
        track(seed.id);

        await repository.observeAtomically(seed.input);

        const updated = await repository.updateStatus({
          sourcePublisherId: seed.id,
          status: "IGNORED",
          updatedAt: "2026-03-01T12:00:00.000Z",
        });

        expect(updated).not.toBeNull();
        expect(updated?.status).toBe("IGNORED");
        expect(updated?.updatedAt).toBe("2026-03-01T12:00:00.000Z");
        expect(updated?.displayName).toBe("Display");
        expect(updated?.canonicalUrl).toBe(
          "https://www.facebook.com/groups/display",
        );
        expect(updated?.observationCount).toBe(1);
        expect(updated?.firstObservedAt).toBe(seed.expected.firstObservedAt);
        expect(updated?.lastObservedAt).toBe(seed.expected.lastObservedAt);
        expect(updated?.createdAt).toBe(seed.expected.createdAt);
        expect(updated?.id).toBe(seed.id);
      });

      it("updateStatus returns null for a missing id", async () => {
        await expect(
          repository.updateStatus({
            sourcePublisherId: "missing-publisher",
            status: "BLOCKED",
            updatedAt: "2026-03-01T12:00:00.000Z",
          }),
        ).resolves.toBeNull();
      });

      it("lists with status, kind, and platform filters and returns ordering by lastObservedAt desc, id asc", async () => {
        const a = await seedListEntry("list-a", "2026-03-01T08:00:00.000Z", "APPROVED", "GROUP");
        const b = await seedListEntry("list-b", "2026-03-01T09:00:00.000Z", "APPROVED", "PAGE");
        const c = await seedListEntry("list-c", "2026-03-02T08:00:00.000Z", "APPROVED", "GROUP");
        const d = await seedListEntry("list-d", "2026-03-03T08:00:00.000Z", "APPROVED", "GROUP");

        const seededExternalIds = [a, b, c, d].map((item) => item.externalPublisherId);

        const seededGroupRows = await client!.db
          .select({ id: sourcePublishers.id })
          .from(sourcePublishers)
          .where(
            and(
              eq(sourcePublishers.status, "APPROVED"),
              eq(sourcePublishers.kind, "GROUP"),
              inArray(sourcePublishers.externalPublisherId, seededExternalIds),
            ),
          );

        expect(seededGroupRows).toHaveLength(3);

        const allApprovedGroups = await repository.list({
          status: "APPROVED",
          kind: "GROUP",
          limit: 10,
          offset: 0,
        });

        const seededReturnedItems = allApprovedGroups.items.filter((item) =>
          seededExternalIds.includes(item.externalPublisherId),
        );
        expect(seededReturnedItems.map((item) => item.id)).toEqual([
          d.id,
          c.id,
          a.id,
        ]);

        const pageOne = await repository.list({
          status: "APPROVED",
          kind: "GROUP",
          limit: 1,
          offset: 0,
        });
        expect(
          pageOne.items.find((item) => item.externalPublisherId === d.externalPublisherId),
        ).toBeDefined();

        const pageTwo = await repository.list({
          status: "APPROVED",
          kind: "GROUP",
          limit: 1,
          offset: 1,
        });
        expect(
          pageTwo.items.find((item) => item.externalPublisherId === c.externalPublisherId),
        ).toBeDefined();

        const platformOnly = await repository.list({
          platform: "FACEBOOK",
          limit: 100,
          offset: 0,
        });
        const ids = new Set(platformOnly.items.map((item) => item.id));
        [a, b, c, d].forEach((expected) => {
          expect(ids.has(expected.id)).toBe(true);
        });
      });

      it("enforces the unique identity index", async () => {
        const external = nextId("external-unique");
        const first = makeSeed({
          id: nextId("unique-first"),
          externalPublisherId: external,
          observedAt: "2026-03-01T08:00:00.000Z",
          updatedAt: "2026-03-01T08:00:00.000Z",
        });
        const second = makeSeed({
          id: nextId("unique-second"),
          externalPublisherId: external,
          observedAt: "2026-03-01T08:30:00.000Z",
          updatedAt: "2026-03-01T08:30:00.000Z",
        });
        track(first.id);
        track(second.id);

        await repository.observeAtomically(first.input);

        const secondResult = await repository.observeAtomically(second.input);
        expect(secondResult.id).toBe(first.id);
        expect(secondResult.observationCount).toBe(2);
        expect(secondResult.lastObservedAt).toBe(second.input.observedAt);
      });

      it("enforces the observation_count check constraint", async () => {
        const seed = makeSeed({
          id: nextId("check-constraint"),
          externalPublisherId: nextId("external-check"),
        });
        track(seed.id + "-bad");

        await expect(
          client!.db.execute(sql`
            INSERT INTO source_publishers (
              id, platform, kind, external_publisher_id,
              display_name, canonical_url, status,
              first_observed_at, last_observed_at,
              observation_count, created_at, updated_at
            ) VALUES (
              ${seed.id + "-bad"},
              ${seed.expected.platform}::content_platform,
              ${seed.expected.kind}::source_publisher_kind,
              ${seed.expected.externalPublisherId + "-bad"},
              NULL,
              NULL,
              'DISCOVERED'::source_publisher_status,
              ${seed.expected.firstObservedAt}::timestamptz,
              ${seed.expected.lastObservedAt}::timestamptz,
              0,
              ${seed.expected.createdAt}::timestamptz,
              ${seed.expected.updatedAt}::timestamptz
            )
          `),
        ).rejects.toBeDefined();
      });

      it("enforces the first_observed_at <= last_observed_at check constraint", async () => {
        const seed = makeSeed({
          id: nextId("first-le-last"),
          externalPublisherId: nextId("external-first-le-last"),
        });
        track(seed.id + "-bad");

        await expect(
          client!.db.execute(sql`
            INSERT INTO source_publishers (
              id, platform, kind, external_publisher_id,
              display_name, canonical_url, status,
              first_observed_at, last_observed_at,
              observation_count, created_at, updated_at
            ) VALUES (
              ${seed.id + "-bad"},
              ${seed.expected.platform}::content_platform,
              ${seed.expected.kind}::source_publisher_kind,
              ${seed.expected.externalPublisherId + "-bad"},
              NULL,
              NULL,
              'DISCOVERED'::source_publisher_status,
              '2026-03-02T08:00:00.000Z'::timestamptz,
              '2026-03-01T08:00:00.000Z'::timestamptz,
              1,
              ${seed.expected.createdAt}::timestamptz,
              ${seed.expected.updatedAt}::timestamptz
            )
          `),
        ).rejects.toBeDefined();
      });

      function nextId(label: string): string {
        counter += 1;
        return `src-pub-it-${process.pid}-${Date.now()}-${counter}-${label}`;
      }

      function track(id: string): void {
        trackedIds.add(id);
      }

      function makeSeed(options: {
        id: string;
        externalPublisherId: string;
        platform?: ContentPlatform;
        kind?: SourcePublisher["kind"];
        status?: SourcePublisher["status"];
        displayName?: string;
        canonicalUrl?: string;
        observedAt?: IsoDateTime;
        updatedAt?: IsoDateTime;
      }): Seed {
        const observedAt = options.observedAt ?? "2026-03-01T08:00:00.000Z";
        const updatedAt = options.updatedAt ?? "2026-03-01T08:05:00.000Z";
        const platform = options.platform ?? "FACEBOOK";
        const kind = options.kind ?? "GROUP";
        const status = options.status ?? "DISCOVERED";

        const baseExpected = {
          id: options.id,
          platform,
          kind,
          externalPublisherId: options.externalPublisherId,
          status,
          firstObservedAt: observedAt,
          lastObservedAt: observedAt,
          observationCount: 1,
          createdAt: updatedAt,
          updatedAt,
        } as SourcePublisher;

        const expected: SourcePublisher =
          options.displayName === undefined
            ? baseExpected
            : { ...baseExpected, displayName: options.displayName };
        const withCanonical: SourcePublisher =
          options.canonicalUrl === undefined
            ? expected
            : { ...expected, canonicalUrl: options.canonicalUrl };

        const baseInput = {
          candidateId: options.id,
          platform,
          kind,
          externalPublisherId: options.externalPublisherId,
          observedAt,
          updatedAt,
        };
        const inputWithDisplayName =
          options.displayName === undefined
            ? baseInput
            : { ...baseInput, displayName: options.displayName };
        const input = {
          ...inputWithDisplayName,
          ...(options.canonicalUrl === undefined
            ? {}
            : { canonicalUrl: options.canonicalUrl }),
        };

        return { id: options.id, expected: withCanonical, input };
      }

      async function seedListEntry(
        label: string,
        observedAt: string,
        status: SourcePublisher["status"],
        kind: SourcePublisher["kind"],
      ): Promise<SourcePublisher> {
        const id = nextId(label);
        const seed = makeSeed({
          id,
          externalPublisherId: nextId(`external-${label}`),
          observedAt,
          updatedAt: "2026-03-01T08:05:00.000Z",
          kind,
        });
        track(id);

        await repository.observeAtomically(seed.input);

        if (status !== "DISCOVERED") {
          const updated = await repository.updateStatus({
            sourcePublisherId: id,
            status,
            updatedAt: "2026-03-01T08:10:00.000Z",
          });
          return updated!;
        }

        return seed.expected;
      }
    },
  );
}

interface Seed {
  readonly id: string;
  readonly expected: SourcePublisher;
  readonly input: {
    readonly candidateId: string;
    readonly platform: ContentPlatform;
    readonly kind: SourcePublisher["kind"];
    readonly externalPublisherId: string;
    readonly observedAt: IsoDateTime;
    readonly updatedAt: IsoDateTime;
    readonly displayName?: string;
    readonly canonicalUrl?: string;
  };
}
