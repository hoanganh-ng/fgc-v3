import { ContentCategoryAlreadyExistsError } from "../application-errors";
import { toIsoDateTime, validateContentCategoryForApplication } from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { ContentCategoryRepository } from "../ports/content-category-repository.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { ContentCategory } from "../../domain";

export interface CreateContentCategoryInput {
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
}

export class CreateContentCategoryUseCase {
  public constructor(
    private readonly categories: ContentCategoryRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: CreateContentCategoryInput,
  ): Promise<ContentCategory> {
    const now = toIsoDateTime(this.clock.now());
    const category = validateContentCategoryForApplication({
      id: await this.ids.generateId(),
      name: input.name,
      slug: input.slug,
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      createdAt: now,
      updatedAt: now,
    });
    const existingCategory = await this.categories.findBySlug(category.slug);

    if (existingCategory !== null) {
      throw new ContentCategoryAlreadyExistsError("slug", category.slug);
    }

    await this.categories.save(category);

    return category;
  }
}
