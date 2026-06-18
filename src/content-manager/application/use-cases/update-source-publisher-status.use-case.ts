import {
  loadValidatedSourcePublisherById,
  toIsoDateTime,
  validateSourcePublisherForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { SourcePublisherRepository } from "../ports/source-publisher-repository.port";
import { applySourcePublisherStatusUpdate } from "../../domain";
import type {
  SourcePublisher,
  SourcePublisherId,
  SourcePublisherStatus,
} from "../../domain";

export interface UpdateSourcePublisherStatusInput {
  readonly sourcePublisherId: SourcePublisherId;
  readonly status: SourcePublisherStatus;
}

export class UpdateSourcePublisherStatusUseCase {
  public constructor(
    private readonly sourcePublishers: SourcePublisherRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: UpdateSourcePublisherStatusInput,
  ): Promise<SourcePublisher> {
    const existing = await loadValidatedSourcePublisherById(
      this.sourcePublishers,
      input.sourcePublisherId,
    );

    const updatedSourcePublisher = validateSourcePublisherForApplication(
      applySourcePublisherStatusUpdate(existing, input.status, {
        updatedAt: toIsoDateTime(this.clock.now()),
      }),
    );

    await this.sourcePublishers.save(updatedSourcePublisher);

    return updatedSourcePublisher;
  }
}
