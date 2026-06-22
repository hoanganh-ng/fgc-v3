import { describe, expect, it } from "vitest";
import {
  ArchiveTransformTypeUseCase,
  CreateTransformTypeUseCase,
  GetTransformTypeUseCase,
  ListTransformTypesUseCase,
  TransformTypeNameAlreadyExistsError,
  TransformTypeValidationError,
  UpdateTransformTypeUseCase,
} from "./index";
import { InMemoryTransformTypeRepository } from "./test-support";
import type { Clock, IdGenerator } from "./index";

class SequenceIdGenerator implements IdGenerator {
  private next = 1;

  public async generateId(): Promise<string> {
    return `transform-type-${this.next++}`;
  }
}

class FixedClock implements Clock {
  private current: Date;

  public constructor(isoDateTime: string) {
    this.current = new Date(isoDateTime);
  }

  public now(): Date {
    return this.current;
  }

  public set(isoDateTime: string): void {
    this.current = new Date(isoDateTime);
  }
}

function createHarness() {
  const repository = new InMemoryTransformTypeRepository();
  const clock = new FixedClock("2026-06-22T00:00:00.000Z");
  const ids = new SequenceIdGenerator();

  return {
    repository,
    clock,
    create: new CreateTransformTypeUseCase(repository, ids, clock),
    update: new UpdateTransformTypeUseCase(repository, clock),
    get: new GetTransformTypeUseCase(repository),
    list: new ListTransformTypesUseCase(repository),
    archive: new ArchiveTransformTypeUseCase(repository, clock),
  };
}

describe("TransformType application use cases", () => {
  it("creates transform types with trimmed required fields and omitted empty description", async () => {
    const harness = createHarness();

    const transformType = await harness.create.execute({
      name: "  Hook Rewrite  ",
      description: "   ",
      initialPrompt: "  Rewrite the source into a short hook.  ",
    });

    expect(transformType).toMatchObject({
      transformTypeId: "transform-type-1",
      name: "Hook Rewrite",
      normalizedName: "hook rewrite",
      initialPrompt: "Rewrite the source into a short hook.",
      status: "ACTIVE",
      createdAt: "2026-06-22T00:00:00.000Z",
      updatedAt: "2026-06-22T00:00:00.000Z",
    });
    expect(transformType).not.toHaveProperty("description");
  });

  it("rejects blank name and prompt input", async () => {
    const harness = createHarness();

    await expect(
      harness.create.execute({
        name: " ",
        initialPrompt: "Prompt",
      }),
    ).rejects.toBeInstanceOf(TransformTypeValidationError);

    await expect(
      harness.create.execute({
        name: "Name",
        initialPrompt: " ",
      }),
    ).rejects.toBeInstanceOf(TransformTypeValidationError);
  });

  it("enforces unique normalized names among active transform types", async () => {
    const harness = createHarness();
    await harness.create.execute({
      name: "Source Summary",
      initialPrompt: "Summarize.",
    });

    await expect(
      harness.create.execute({
        name: "  source   summary ",
        initialPrompt: "Summarize differently.",
      }),
    ).rejects.toBeInstanceOf(TransformTypeNameAlreadyExistsError);
  });

  it("allows creating a new active transform type with the same name after archiving", async () => {
    const harness = createHarness();
    const first = await harness.create.execute({
      name: "Source Summary",
      initialPrompt: "Summarize.",
    });
    await harness.archive.execute({ transformTypeId: first.transformTypeId });

    const second = await harness.create.execute({
      name: "Source Summary",
      initialPrompt: "Summarize v2.",
    });

    expect(second.transformTypeId).toBe("transform-type-2");
    expect(second.status).toBe("ACTIVE");
  });

  it("updates fields, clears descriptions, and keeps archived transform types readable", async () => {
    const harness = createHarness();
    const created = await harness.create.execute({
      name: "Draft",
      description: "Initial",
      initialPrompt: "One",
    });
    harness.clock.set("2026-06-22T01:00:00.000Z");

    const updated = await harness.update.execute({
      transformTypeId: created.transformTypeId,
      name: "Final",
      clearDescription: true,
      initialPrompt: "Two",
    });

    expect(updated).toMatchObject({
      name: "Final",
      normalizedName: "final",
      initialPrompt: "Two",
      updatedAt: "2026-06-22T01:00:00.000Z",
    });
    expect(updated).not.toHaveProperty("description");

    harness.clock.set("2026-06-22T02:00:00.000Z");
    const archived = await harness.archive.execute({
      transformTypeId: created.transformTypeId,
    });
    const loaded = await harness.get.execute({
      transformTypeId: created.transformTypeId,
    });

    expect(archived.status).toBe("ARCHIVED");
    expect(loaded.status).toBe("ARCHIVED");
  });

  it("lists transform types with status filters and pagination", async () => {
    const harness = createHarness();
    const first = await harness.create.execute({
      name: "First",
      initialPrompt: "One",
    });
    harness.clock.set("2026-06-22T01:00:00.000Z");
    await harness.create.execute({
      name: "Second",
      initialPrompt: "Two",
    });
    await harness.archive.execute({ transformTypeId: first.transformTypeId });

    const active = await harness.list.execute({ status: "ACTIVE" });
    const archived = await harness.list.execute({ status: "ARCHIVED" });

    expect(active.items.map((item) => item.name)).toEqual(["Second"]);
    expect(archived.items.map((item) => item.name)).toEqual(["First"]);
    expect(active.page).toEqual({ limit: 50, offset: 0, total: 1 });
  });
});
