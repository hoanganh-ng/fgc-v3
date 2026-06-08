import { InvalidContentStatusTransitionError } from "../application-errors";
import {
  loadValidatedContentItemById,
  toIsoDateTime,
  validateContentItemForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { ContentItemRepository } from "../ports/content-item-repository.port";
import {
  canTransitionContentStatus,
  type ContentId,
  type ContentItem,
  type ContentStatus,
} from "../../domain";

export interface UpdateContentStatusInput {
  readonly contentId: ContentId;
  readonly status: ContentStatus;
}

export class UpdateContentStatusUseCase {
  public constructor(
    private readonly contentItems: ContentItemRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(input: UpdateContentStatusInput): Promise<ContentItem> {
    const contentItem = await loadValidatedContentItemById(
      this.contentItems,
      input.contentId,
    );

    if (!canTransitionContentStatus(contentItem.status, input.status)) {
      throw new InvalidContentStatusTransitionError(
        contentItem.status,
        input.status,
      );
    }

    const updatedContentItem = validateContentItemForApplication({
      ...contentItem,
      status: input.status,
      updatedAt: toIsoDateTime(this.clock.now()),
    });

    await this.contentItems.save(updatedContentItem);

    return updatedContentItem;
  }
}
