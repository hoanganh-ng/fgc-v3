import {
  loadValidatedSourcePublisherById,
  toIsoDateTime,
  validateSourcePublisherForApplication,
} from "../content-validation";
import { SourcePublisherNotFoundError } from "../application-errors";
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
    const updatedAt = toIsoDateTime(this.clock.now());
    const existing = await loadValidatedSourcePublisherById(
      this.sourcePublishers,
      input.sourcePublisherId,
    );

    const candidate = applySourcePublisherStatusUpdate(
      existing,
      input.status,
      { updatedAt },
    );

    const validatedCandidate = validateSourcePublisherForApplication(candidate);

    if (validatedCandidate.status === existing.status) {
      return existing;
    }

    const updated = await this.sourcePublishers.updateStatus({
      sourcePublisherId: existing.id,
      status: input.status,
      updatedAt,
    });

    if (updated === null) {
      throw new SourcePublisherNotFoundError(existing.id);
    }

    return validateSourcePublisherForApplication(updated);
  }
}
