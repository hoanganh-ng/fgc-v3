import { loadValidatedContentItemById } from "../content-validation";
import type { ContentItemRepository } from "../ports/content-item-repository.port";
import type { ContentId, ContentItem } from "../../domain";

export interface GetContentItemInput {
  readonly contentId: ContentId;
}

export class GetContentItemUseCase {
  public constructor(private readonly contentItems: ContentItemRepository) {}

  public async execute(input: GetContentItemInput): Promise<ContentItem> {
    return loadValidatedContentItemById(this.contentItems, input.contentId);
  }
}
