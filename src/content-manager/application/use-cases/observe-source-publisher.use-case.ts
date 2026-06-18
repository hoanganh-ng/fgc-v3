import {
  toIsoDateTime,
  validateObserveSourcePublisherInputForApplication,
  validateSourcePublisherForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { SourcePublisherRepository } from "../ports/source-publisher-repository.port";
import type {
  ObserveSourcePublisherApplicationInput,
  SourcePublisher,
} from "../../domain";

export type { ObserveSourcePublisherApplicationInput };

export class ObserveSourcePublisherUseCase {
  public constructor(
    private readonly sourcePublishers: SourcePublisherRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: ObserveSourcePublisherApplicationInput,
  ): Promise<SourcePublisher> {
    const validated = validateObserveSourcePublisherInputForApplication(input);
    const updatedAt = toIsoDateTime(this.clock.now());
    const candidateId = await this.ids.generateId();

    const sourcePublisher = validateSourcePublisherForApplication(
      await this.sourcePublishers.observeAtomically({
        candidateId,
        platform: validated.platform,
        kind: validated.kind,
        externalPublisherId: validated.externalPublisherId,
        observedAt: validated.observedAt,
        updatedAt,
        ...(validated.displayName !== undefined
          ? { displayName: validated.displayName }
          : {}),
        ...(validated.canonicalUrl !== undefined
          ? { canonicalUrl: validated.canonicalUrl }
          : {}),
      }),
    );

    return sourcePublisher;
  }
}
