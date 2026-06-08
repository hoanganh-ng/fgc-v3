import { validateContentCategoryForApplication } from "../content-validation";
import type { ContentCategoryRepository } from "../ports/content-category-repository.port";
import type { ContentCategory } from "../../domain";

export class ListContentCategoriesUseCase {
  public constructor(
    private readonly categories: ContentCategoryRepository,
  ) {}

  public async execute(): Promise<readonly ContentCategory[]> {
    const categories = await this.categories.list();

    return categories.map((category) =>
      validateContentCategoryForApplication(category),
    );
  }
}
