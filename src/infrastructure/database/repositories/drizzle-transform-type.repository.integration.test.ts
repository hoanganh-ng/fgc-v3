import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TransformType } from "../../../content-builder/domain";
import {
  createTransformType as createTransformTypeDomain,
  normalizeTransformTypeName,
} from "../../../content-builder/domain";
import { createDatabaseClient, type DatabaseClient } from "../client";
import { contentBuilderTransformTypes } from "../schema/content-builder.schema";
import { DrizzleTransformTypeRepository } from "./drizzle-transform-type.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip(
    "Content Builder PostgreSQL transform type repository integration",
    () => {
      it("runs only when RUN_DB_TESTS=true", () => {});
    },
  );
} else {
  describe(
    "Content Builder PostgreSQL transform type repository integration",
    () => {
      let client: DatabaseClient | undefined;
      let repository: DrizzleTransformTypeRepository;
      let counter = 0;
      const trackedTransformTypeIds = new Set<string>();

      beforeAll(() => {
        const databaseClient = createDatabaseClient({
          poolConfig: {
            max: 2,
          },
        });
        client = databaseClient;
        repository = new DrizzleTransformTypeRepository(databaseClient.db);
      });

      afterEach(async () => {
        if (client === undefined || trackedTransformTypeIds.size === 0) {
          return;
        }

        await client.db
          .delete(contentBuilderTransformTypes)
          .where(
            inArray(
              contentBuilderTransformTypes.transformTypeId,
              [...trackedTransformTypeIds],
            ),
          );
        trackedTransformTypeIds.clear();
      });

      afterAll(async () => {
        await client?.close();
      });

      it("saves a new transform type and loads it by id", async () => {
        const transformTypeId = nextTransformTypeId("create");
        const created = track(
          createTransformTypeDomain({
            transformTypeId,
            name: "Hook Rewrite",
            description: "Creates a hook.",
            initialPrompt: "Rewrite this into a hook.",
            createdAt: "2026-06-22T10:00:00.000Z",
            updatedAt: "2026-06-22T10:00:00.000Z",
          }),
        );

        await repository.save(created);

        await expect(repository.findById(transformTypeId)).resolves.toEqual(
          created,
        );
      });

      it("preserves createdAt and changes updatedAt on update", async () => {
        const transformTypeId = nextTransformTypeId("update");
        const initial = track(
          createTransformTypeDomain({
            transformTypeId,
            name: "Hook Rewrite",
            description: "Creates a hook.",
            initialPrompt: "Rewrite this into a hook.",
            createdAt: "2026-06-22T10:00:00.000Z",
            updatedAt: "2026-06-22T10:00:00.000Z",
          }),
        );

        await repository.save(initial);

        const updated = track(
          createTransformTypeDomain({
            transformTypeId,
            name: "Hook Rewrite",
            description: "Creates a tighter hook.",
            initialPrompt: "Rewrite this into a hook.",
            createdAt: "2099-01-01T00:00:00.000Z",
            updatedAt: "2026-06-22T11:00:00.000Z",
          }),
        );

        await repository.save(updated);

        await expect(repository.findById(transformTypeId)).resolves.toEqual({
          ...updated,
          createdAt: initial.createdAt,
        });
      });

      it("changes updatedAt when archiving", async () => {
        const transformTypeId = nextTransformTypeId("archive");
        const initial = track(
          createTransformTypeDomain({
            transformTypeId,
            name: "Hook Rewrite",
            description: "Creates a hook.",
            initialPrompt: "Rewrite this into a hook.",
            createdAt: "2026-06-22T10:00:00.000Z",
            updatedAt: "2026-06-22T10:00:00.000Z",
          }),
        );

        await repository.save(initial);

        const archived = track({
          ...initial,
          status: "ARCHIVED" as const,
          updatedAt: "2026-06-22T12:00:00.000Z",
        });

        await repository.save(archived);

        const stored = await repository.findById(transformTypeId);

        expect(stored).not.toBeNull();
        expect(stored?.status).toBe("ARCHIVED");
        expect(stored?.updatedAt).toBe("2026-06-22T12:00:00.000Z");
        expect(stored?.createdAt).toBe(initial.createdAt);
      });

      it("lists transform types with ACTIVE filter", async () => {
        const activeA = track(
          createTransformTypeDomain({
            transformTypeId: nextTransformTypeId("list-active-a"),
            name: "Active A",
            initialPrompt: "Prompt A",
            createdAt: "2026-06-22T10:00:00.000Z",
            updatedAt: "2026-06-22T10:00:00.000Z",
          }),
        );
        const activeB = track(
          createTransformTypeDomain({
            transformTypeId: nextTransformTypeId("list-active-b"),
            name: "Active B",
            initialPrompt: "Prompt B",
            createdAt: "2026-06-22T11:00:00.000Z",
            updatedAt: "2026-06-22T11:00:00.000Z",
          }),
        );
        const archived = track(
          createTransformTypeDomain({
            transformTypeId: nextTransformTypeId("list-archived"),
            name: "Archived",
            initialPrompt: "Archived prompt",
            createdAt: "2026-06-22T09:00:00.000Z",
            updatedAt: "2026-06-22T09:30:00.000Z",
          }),
        );

        await repository.save(activeA);
        await repository.save(activeB);
        await repository.save(archived);
        await repository.save(
          track({
            ...archived,
            status: "ARCHIVED" as const,
            updatedAt: "2026-06-22T09:45:00.000Z",
          }),
        );

        const activeOnly = await repository.list({
          status: "ACTIVE",
          limit: 100,
          offset: 0,
        });

        const returnedIds = activeOnly.items
          .map((item) => item.transformTypeId)
          .filter((id) => trackedTransformTypeIds.has(id));

        expect(returnedIds).toContain(activeA.transformTypeId);
        expect(returnedIds).toContain(activeB.transformTypeId);
        expect(returnedIds).not.toContain(archived.transformTypeId);
        expect(activeOnly.total).toBeGreaterThanOrEqual(2);
      });

      it("lists transform types with ARCHIVED filter", async () => {
        const archived = track(
          createTransformTypeDomain({
            transformTypeId: nextTransformTypeId("list-archived-only"),
            name: "Archived Only",
            initialPrompt: "Archived prompt",
            createdAt: "2026-06-22T10:00:00.000Z",
            updatedAt: "2026-06-22T10:00:00.000Z",
          }),
        );

        await repository.save(archived);

        await repository.save(track({
          ...archived,
          status: "ARCHIVED" as const,
          updatedAt: "2026-06-22T11:00:00.000Z",
        }));

        const archivedOnly = await repository.list({
          status: "ARCHIVED",
          limit: 100,
          offset: 0,
        });

        const returnedIds = archivedOnly.items
          .map((item) => item.transformTypeId)
          .filter((id) => trackedTransformTypeIds.has(id));

        expect(returnedIds).toContain(archived.transformTypeId);
        expect(archivedOnly.total).toBeGreaterThanOrEqual(1);
      });

      it("orders list results by createdAt asc then transformTypeId asc", async () => {
        const prefix = nextTransformTypeId("order");
        const olderA = track(
          createTransformTypeDomain({
            transformTypeId: `${prefix}-a`,
            name: "Order A",
            initialPrompt: "Prompt A",
            createdAt: "2026-06-22T08:00:00.000Z",
            updatedAt: "2026-06-22T08:00:00.000Z",
          }),
        );
        const olderB = track(
          createTransformTypeDomain({
            transformTypeId: `${prefix}-b`,
            name: "Order B",
            initialPrompt: "Prompt B",
            createdAt: "2026-06-22T08:00:00.000Z",
            updatedAt: "2026-06-22T08:00:00.000Z",
          }),
        );
        const newer = track(
          createTransformTypeDomain({
            transformTypeId: `${prefix}-c`,
            name: "Order C",
            initialPrompt: "Prompt C",
            createdAt: "2026-06-22T09:00:00.000Z",
            updatedAt: "2026-06-22T09:00:00.000Z",
          }),
        );

        await repository.save(newer);
        await repository.save(olderB);
        await repository.save(olderA);

        const allItems = await repository.list({
          limit: 1000,
          offset: 0,
        });

        const seededItems = allItems.items.filter((item) =>
          item.transformTypeId.startsWith(prefix),
        );

        expect(seededItems.map((item) => item.transformTypeId)).toEqual([
          olderA.transformTypeId,
          olderB.transformTypeId,
          newer.transformTypeId,
        ]);
      });

      it("applies deterministic limit and offset pagination", async () => {
        const prefix = nextTransformTypeId("page");
        const createdAt = "2026-06-22T07:00:00.000Z";
        const seeded: TransformType[] = [];
        for (let i = 0; i < 3; i += 1) {
          const transformTypeId = `${prefix}-${i.toString().padStart(2, "0")}`;
          const transformType = track(
            createTransformTypeDomain({
              transformTypeId,
              name: `Page ${i}`,
              initialPrompt: `Prompt ${i}`,
              createdAt,
              updatedAt: createdAt,
            }),
          );
          seeded.push(transformType);
          await repository.save(transformType);
        }

        const firstPage = await repository.list({
          limit: 1,
          offset: 0,
        });
        const secondPage = await repository.list({
          limit: 1,
          offset: 1,
        });

        const firstPageSeeded = firstPage.items.filter((item) =>
          item.transformTypeId.startsWith(prefix),
        );
        const secondPageSeeded = secondPage.items.filter((item) =>
          item.transformTypeId.startsWith(prefix),
        );

        expect(firstPageSeeded.map((item) => item.transformTypeId)).toEqual([
          seeded[0]!.transformTypeId,
        ]);
        expect(secondPageSeeded.map((item) => item.transformTypeId)).toEqual([
          seeded[1]!.transformTypeId,
        ]);
      });

      it("rejects duplicate ACTIVE normalized name via the partial unique index", async () => {
        const firstId = nextTransformTypeId("unique-a");
        const secondId = nextTransformTypeId("unique-b");
        const normalizedName = normalizeTransformTypeName("Hook Rewrite");

        await repository.save(
          track(
            createTransformTypeDomain({
              transformTypeId: firstId,
              name: "Hook Rewrite",
              initialPrompt: "Prompt A",
              createdAt: "2026-06-22T10:00:00.000Z",
              updatedAt: "2026-06-22T10:00:00.000Z",
            }),
          ),
        );

        const duplicate = createTransformTypeDomain({
          transformTypeId: secondId,
          name: "  Hook  Rewrite  ",
          initialPrompt: "Prompt B",
          createdAt: "2026-06-22T11:00:00.000Z",
          updatedAt: "2026-06-22T11:00:00.000Z",
        });

        expect(duplicate.normalizedName).toBe(normalizedName);

        await expect(repository.save(duplicate)).rejects.toMatchObject({
          cause: {
            code: "23505",
            constraint: "content_builder_transform_types_active_name_uidx",
          },
        });

        await expect(
          repository.findActiveByNormalizedName(normalizedName),
        ).resolves.toMatchObject({ transformTypeId: firstId });
      });

      it("allows creating a new ACTIVE transform type with the same normalized name after archiving the previous one", async () => {
        const firstId = nextTransformTypeId("reuse-archived");
        const secondId = nextTransformTypeId("reuse-new");
        const normalizedName = normalizeTransformTypeName("Hook Rewrite");

        await repository.save(
          track(
            createTransformTypeDomain({
              transformTypeId: firstId,
              name: "Hook Rewrite",
              initialPrompt: "Original prompt",
              createdAt: "2026-06-22T10:00:00.000Z",
              updatedAt: "2026-06-22T10:00:00.000Z",
            }),
          ),
        );

        await repository.save(
          track({
            ...(await repository.findById(firstId))!,
            status: "ARCHIVED" as const,
            updatedAt: "2026-06-22T10:30:00.000Z",
          }),
        );

        await expect(
          repository.findActiveByNormalizedName(normalizedName),
        ).resolves.toBeNull();

        const replacement = track(
          createTransformTypeDomain({
            transformTypeId: secondId,
            name: "Hook Rewrite",
            initialPrompt: "Replacement prompt",
            createdAt: "2026-06-22T11:00:00.000Z",
            updatedAt: "2026-06-22T11:00:00.000Z",
          }),
        );

        await repository.save(replacement);

        await expect(repository.findById(secondId)).resolves.toEqual(
          replacement,
        );
        await expect(
          repository.findActiveByNormalizedName(normalizedName),
        ).resolves.toMatchObject({ transformTypeId: secondId });
      });

      function nextTransformTypeId(label: string): string {
        counter += 1;

        return `cb-tt-db-it-${process.pid}-${Date.now()}-${counter}-${label}`;
      }

      function track(transformType: TransformType): TransformType {
        trackedTransformTypeIds.add(transformType.transformTypeId);

        return transformType;
      }
    },
  );
}