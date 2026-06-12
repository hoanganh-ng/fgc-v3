import { describe, expect, it } from "vitest";
import {
  AddSourceGroupEntryRouteUseCase,
  CreateContentCategoryUseCase,
  CreateSourceGroupUseCase,
  GetContentItemUseCase,
  GetSourceGroupUseCase,
  IngestCollectedContentUseCase,
  ListContentCategoriesUseCase,
  ListContentItemsUseCase,
  ListSourceGroupsUseCase,
  RemoveSourceGroupEntryRouteUseCase,
  UpdateContentStatusUseCase,
  UpdateSourceGroupEntryRouteUseCase,
  UpdateSourceGroupStatusUseCase,
} from "../../content-manager/application";
import type { Clock, IdGenerator } from "../../content-manager/application";
import {
  InMemoryContentCategoryRepository,
  InMemoryContentItemRepository,
  InMemorySourceGroupRepository,
} from "../../content-manager/application/test-support/in-memory-repositories";
import type { DatabaseClient } from "../../infrastructure/database";
import { createContentManager } from "./content-manager.container";
import { createContentManagerFromDatabaseClient } from "./create-content-manager";

describe("content manager composition container", () => {
  it("creates all expected services from supplied dependencies", async () => {
    let closed = false;
    const services = createContentManager({
      categories: new InMemoryContentCategoryRepository(),
      sourceGroups: new InMemorySourceGroupRepository(),
      contentItems: new InMemoryContentItemRepository(),
      clock: new FixedClock(),
      idGenerator: new FakeIdGenerator(),
      close: async () => {
        closed = true;
      },
    });

    expectContentManagerServices(services);

    await services.close();

    expect(closed).toBe(true);
  });

  it("creates services from a database client without HTTP construction", async () => {
    let closed = false;
    const databaseClient = {
      db: {},
      pool: {},
      close: async () => {
        closed = true;
      },
    } as DatabaseClient;
    const services = createContentManagerFromDatabaseClient(databaseClient, {
      clock: new FixedClock(),
      idGenerator: new FakeIdGenerator(),
    });

    expectContentManagerServices(services);

    await services.close();

    expect(closed).toBe(true);
  });
});

function expectContentManagerServices(services: {
  readonly createContentCategory: unknown;
  readonly listContentCategories: unknown;
  readonly createSourceGroup: unknown;
  readonly getSourceGroup: unknown;
  readonly addSourceGroupEntryRoute: unknown;
  readonly updateSourceGroupEntryRoute: unknown;
  readonly removeSourceGroupEntryRoute: unknown;
  readonly updateSourceGroupStatus: unknown;
  readonly listSourceGroups: unknown;
  readonly ingestCollectedContent: unknown;
  readonly updateContentStatus: unknown;
  readonly getContentItem: unknown;
  readonly listContentItems: unknown;
}): void {
  expect(services.createContentCategory).toBeInstanceOf(
    CreateContentCategoryUseCase,
  );
  expect(services.listContentCategories).toBeInstanceOf(
    ListContentCategoriesUseCase,
  );
  expect(services.createSourceGroup).toBeInstanceOf(CreateSourceGroupUseCase);
  expect(services.getSourceGroup).toBeInstanceOf(GetSourceGroupUseCase);
  expect(services.addSourceGroupEntryRoute).toBeInstanceOf(
    AddSourceGroupEntryRouteUseCase,
  );
  expect(services.updateSourceGroupEntryRoute).toBeInstanceOf(
    UpdateSourceGroupEntryRouteUseCase,
  );
  expect(services.removeSourceGroupEntryRoute).toBeInstanceOf(
    RemoveSourceGroupEntryRouteUseCase,
  );
  expect(services.updateSourceGroupStatus).toBeInstanceOf(
    UpdateSourceGroupStatusUseCase,
  );
  expect(services.listSourceGroups).toBeInstanceOf(ListSourceGroupsUseCase);
  expect(services.ingestCollectedContent).toBeInstanceOf(
    IngestCollectedContentUseCase,
  );
  expect(services.updateContentStatus).toBeInstanceOf(
    UpdateContentStatusUseCase,
  );
  expect(services.getContentItem).toBeInstanceOf(GetContentItemUseCase);
  expect(services.listContentItems).toBeInstanceOf(ListContentItemsUseCase);
}

class FixedClock implements Clock {
  public now(): Date {
    return new Date("2026-01-01T00:00:00.000Z");
  }
}

class FakeIdGenerator implements IdGenerator {
  public async generateId(): Promise<string> {
    return "content-id-1";
  }
}
