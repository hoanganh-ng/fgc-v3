import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SourcePublisher } from "../../../content-manager/domain";
import { createDatabaseClient, type DatabaseClient } from "../client";
import { sourcePublishers } from "../schema/content-manager.schema";
import { DrizzleSourcePublisherRepository } from "./drizzle-source-publisher.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip(
    "Content Manager Source Publisher PostgreSQL concurrency integration",
    () => {
      it("runs only when RUN_DB_TESTS=true", () => {});
    },
  );
} else {
  describe(
    "Content Manager Source Publisher PostgreSQL concurrency integration",
    () => {
      let client: DatabaseClient | undefined;
      let counter = 0;
      const trackedIds = new Set<string>();

      beforeAll(() => {
        const databaseClient = createDatabaseClient({
          poolConfig: {
            max: 8,
          },
        });
        client = databaseClient;
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

      it("concurrent first observations for one identity create exactly one row with a converged observationCount", async () => {
        const external = nextExternal("concurrent-first");
        const platform = "FACEBOOK" as const;
        const kind = "GROUP" as const;
        const participantCount = 6;

        const observations = Array.from({ length: participantCount }, (_, index) => ({
          candidateId: nextId(`concurrent-first-cand-${index}`),
          platform,
          kind,
          externalPublisherId: external,
          observedAt: `2026-03-01T08:0${index}:00.000Z`,
          updatedAt: `2026-03-01T08:0${index}:05.000Z`,
          displayName: `Concurrent Name ${index}`,
          canonicalUrl: `https://www.facebook.com/groups/concurrent-${index}`,
        }));

        const repositories = observations.map(
          () => new DrizzleSourcePublisherRepository(client!.db),
        );
        const results = await Promise.all(
          observations.map((input, index) =>
            repositories[index]!.observeAtomically(input),
          ),
        );

        const returnedIds = new Set(results.map((result) => result.id));
        expect(returnedIds.size).toBe(1);
        const durableId = [...returnedIds][0]!;
        trackedIds.add(durableId);

        for (const result of results) {
          expect(result.id).toBe(durableId);
        }

        const allRows = await client!.db
          .select()
          .from(sourcePublishers)
          .where(inArray(sourcePublishers.externalPublisherId, [external]));
        expect(allRows).toHaveLength(1);
        expect(allRows[0]?.id).toBe(durableId);
        expect(allRows[0]?.observationCount).toBe(participantCount);

        const firstObservedAt = allRows[0]?.firstObservedAt;
        const createdAt = allRows[0]?.createdAt;
        expect(typeof firstObservedAt).toBe("string");
        expect(typeof createdAt).toBe("string");
      });

      it("concurrent re-observations against an existing identity never lose a count", async () => {
        const external = nextExternal("concurrent-reobserve");
        const seeded = await seedOne({
          external,
          observedAt: "2026-03-01T08:00:00.000Z",
          updatedAt: "2026-03-01T08:05:00.000Z",
          displayName: "Initial",
        });
        const seedCount = seeded.observationCount;
        trackedIds.add(seeded.id);

        const participantCount = 6;
        const observations = Array.from({ length: participantCount }, (_, index) => ({
          candidateId: nextId(`concurrent-reobserve-cand-${index}`),
          platform: seeded.platform,
          kind: seeded.kind,
          externalPublisherId: external,
          observedAt: `2026-03-01T09:0${index}:00.000Z`,
          updatedAt: `2026-03-01T09:0${index}:05.000Z`,
          displayName: `Reobserved ${index}`,
        }));

        const repositories = observations.map(
          () => new DrizzleSourcePublisherRepository(client!.db),
        );
        const results = await Promise.all(
          observations.map((input, index) =>
            repositories[index]!.observeAtomically(input),
          ),
        );

        for (const result of results) {
          expect(result.id).toBe(seeded.id);
        }

        const allRows = await client!.db
          .select()
          .from(sourcePublishers)
          .where(inArray(sourcePublishers.id, [seeded.id]));
        expect(allRows).toHaveLength(1);
        expect(allRows[0]?.observationCount).toBe(seedCount + participantCount);
      });

      it("final lastObservedAt equals the maximum observedAt across mixed-age observations", async () => {
        const external = nextExternal("concurrent-monotonic");
        const seeded = await seedOne({
          external,
          observedAt: "2026-03-01T08:00:00.000Z",
          updatedAt: "2026-03-01T08:05:00.000Z",
          displayName: "Seed",
        });
        trackedIds.add(seeded.id);

        const newestObservedAt = "2026-03-01T12:30:00.000Z";
        const observations = [
          { observedAt: "2026-03-01T07:00:00.000Z", updatedAt: "2026-03-01T07:05:00.000Z" },
          { observedAt: "2026-03-01T11:00:00.000Z", updatedAt: "2026-03-01T11:05:00.000Z" },
          { observedAt: newestObservedAt, updatedAt: "2026-03-01T12:30:05.000Z" },
          { observedAt: "2026-03-01T09:00:00.000Z", updatedAt: "2026-03-01T09:05:00.000Z" },
        ];

        const inputs = observations.map((observation, index) => ({
          candidateId: nextId(`concurrent-monotonic-cand-${index}`),
          platform: seeded.platform,
          kind: seeded.kind,
          externalPublisherId: external,
          observedAt: observation.observedAt,
          updatedAt: observation.updatedAt,
          displayName: `Mixed ${index}`,
        }));

        const repositories = inputs.map(
          () => new DrizzleSourcePublisherRepository(client!.db),
        );
        await Promise.all(
          inputs.map((input, index) =>
            repositories[index]!.observeAtomically(input),
          ),
        );

        const [row] = await client!.db
          .select()
          .from(sourcePublishers)
          .where(inArray(sourcePublishers.id, [seeded.id]));
        expect(row).toBeDefined();
        expect(new Date(row!.lastObservedAt).toISOString()).toBe(
          new Date(newestObservedAt).toISOString(),
        );
      });

      it("a uniquely newest observation wins metadata even when other observations lock first", async () => {
        const external = nextExternal("concurrent-metadata");
        const seeded = await seedOne({
          external,
          observedAt: "2026-03-01T08:00:00.000Z",
          updatedAt: "2026-03-01T08:05:00.000Z",
          displayName: "Initial",
        });
        trackedIds.add(seeded.id);

        const newestObservedAt = "2026-03-01T13:00:00.000Z";
        const inputs = [
          {
            candidateId: nextId("concurrent-metadata-old-1"),
            platform: seeded.platform,
            kind: seeded.kind,
            externalPublisherId: external,
            observedAt: "2026-03-01T10:00:00.000Z",
            updatedAt: "2026-03-01T10:05:00.000Z",
            displayName: "Stale-1",
            canonicalUrl: "https://www.facebook.com/groups/stale-1",
          },
          {
            candidateId: nextId("concurrent-metadata-newest"),
            platform: seeded.platform,
            kind: seeded.kind,
            externalPublisherId: external,
            observedAt: newestObservedAt,
            updatedAt: "2026-03-01T13:05:00.000Z",
            displayName: "Winning Name",
            canonicalUrl: "https://www.facebook.com/groups/winning",
          },
          {
            candidateId: nextId("concurrent-metadata-old-2"),
            platform: seeded.platform,
            kind: seeded.kind,
            externalPublisherId: external,
            observedAt: "2026-03-01T11:00:00.000Z",
            updatedAt: "2026-03-01T11:05:00.000Z",
            displayName: "Stale-2",
            canonicalUrl: "https://www.facebook.com/groups/stale-2",
          },
        ];

        const repositories = inputs.map(
          () => new DrizzleSourcePublisherRepository(client!.db),
        );
        await Promise.all(
          inputs.map((input, index) =>
            repositories[index]!.observeAtomically(input),
          ),
        );

        const stored = await new DrizzleSourcePublisherRepository(
          client!.db,
        ).findById(seeded.id);
        expect(stored?.displayName).toBe("Winning Name");
        expect(stored?.canonicalUrl).toBe(
          "https://www.facebook.com/groups/winning",
        );
        expect(new Date(stored!.lastObservedAt).toISOString()).toBe(
          new Date(newestObservedAt).toISOString(),
        );
      });

      it("a concurrent APPROVED status survives a flood of observations", async () => {
        const external = nextExternal("concurrent-status");
        const seeded = await seedOne({
          external,
          observedAt: "2026-03-01T08:00:00.000Z",
          updatedAt: "2026-03-01T08:05:00.000Z",
          displayName: "Seed",
        });
        trackedIds.add(seeded.id);

        await new DrizzleSourcePublisherRepository(client!.db).updateStatus({
          sourcePublisherId: seeded.id,
          status: "APPROVED",
          updatedAt: "2026-03-01T08:10:00.000Z",
        });

        const observations = Array.from({ length: 5 }, (_, index) => ({
          candidateId: nextId(`concurrent-status-cand-${index}`),
          platform: seeded.platform,
          kind: seeded.kind,
          externalPublisherId: external,
          observedAt: `2026-03-01T09:0${index}:00.000Z`,
          updatedAt: `2026-03-01T09:0${index}:05.000Z`,
          displayName: `Observed ${index}`,
        }));

        const repositories = observations.map(
          () => new DrizzleSourcePublisherRepository(client!.db),
        );
        await Promise.all(
          observations.map((input, index) =>
            repositories[index]!.observeAtomically(input),
          ),
        );

        const stored = await new DrizzleSourcePublisherRepository(
          client!.db,
        ).findById(seeded.id);
        expect(stored?.status).toBe("APPROVED");
        expect(stored?.observationCount).toBe(1 + observations.length);
      });

      it("a real status update concurrent with observations isolates observation and status writes", async () => {
        const external = nextExternal("concurrent-status-vs-obs");
        const seeded = await seedOne({
          external,
          observedAt: "2026-03-01T08:00:00.000Z",
          updatedAt: "2026-03-01T08:05:00.000Z",
          displayName: "Initial",
        });
        trackedIds.add(seeded.id);

        const observations = Array.from({ length: 4 }, (_, index) => ({
          candidateId: nextId(`concurrent-status-vs-obs-cand-${index}`),
          platform: seeded.platform,
          kind: seeded.kind,
          externalPublisherId: external,
          observedAt: `2026-03-01T09:0${index}:00.000Z`,
          updatedAt: `2026-03-01T09:0${index}:05.000Z`,
          displayName: `Observed ${index}`,
        }));

        const observationRepositories = observations.map(
          () => new DrizzleSourcePublisherRepository(client!.db),
        );
        const statusRepository = new DrizzleSourcePublisherRepository(
          client!.db,
        );

        await Promise.all([
          ...observations.map((input, index) =>
            observationRepositories[index]!.observeAtomically(input),
          ),
          statusRepository.updateStatus({
            sourcePublisherId: seeded.id,
            status: "BLOCKED",
            updatedAt: "2026-03-01T10:00:00.000Z",
          }),
        ]);

        const stored = await statusRepository.findById(seeded.id);
        expect(stored?.status).toBe("BLOCKED");
        expect(stored?.observationCount).toBe(1 + observations.length);
        expect(stored?.displayName).toBe("Initial");
        expect(new Date(stored!.lastObservedAt).toISOString()).toBe(
          new Date("2026-03-01T09:03:00.000Z").toISOString(),
        );
      });

      function nextId(label: string): string {
        counter += 1;
        return `src-pub-conc-${process.pid}-${Date.now()}-${counter}-${label}`;
      }

      function nextExternal(label: string): string {
        counter += 1;
        return `src-pub-conc-ext-${process.pid}-${Date.now()}-${counter}-${label}`;
      }

      async function seedOne(options: {
        external: string;
        observedAt: string;
        updatedAt: string;
        displayName?: string;
      }): Promise<SourcePublisher> {
        const id = nextId("seed");
        const repository = new DrizzleSourcePublisherRepository(client!.db);
        const baseInput = {
          candidateId: id,
          platform: "FACEBOOK" as const,
          kind: "GROUP" as const,
          externalPublisherId: options.external,
          observedAt: options.observedAt,
          updatedAt: options.updatedAt,
        };
        const result = await repository.observeAtomically(
          options.displayName === undefined
            ? baseInput
            : { ...baseInput, displayName: options.displayName },
        );
        return result;
      }
    },
  );
}
