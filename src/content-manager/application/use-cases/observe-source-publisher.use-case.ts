import {
  loadValidatedSourcePublisherByIdentity,
  toIsoDateTime,
  validateObserveSourcePublisherInputForApplication,
  validateSourcePublisherForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { SourcePublisherRepository } from "../ports/source-publisher-repository.port";
import { observeSourcePublisher } from "../../domain";
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
    const existing = await loadValidatedSourcePublisherByIdentity(
      this.sourcePublishers,
      validated.platform,
      validated.kind,
      validated.externalPublisherId,
    );

    const id = existing?.id ?? (await this.ids.generateId());

    const sourcePublisher = validateSourcePublisherForApplication(
      observeSourcePublisher(
        existing,
        {
          id,
          identity: {
            platform: validated.platform,
            kind: validated.kind,
            externalPublisherId: validated.externalPublisherId,
          },
          observedAt: validated.observedAt,
          ...(validated.displayName !== undefined
            ? { displayName: validated.displayName }
            : {}),
          ...(validated.canonicalUrl !== undefined
            ? { canonicalUrl: validated.canonicalUrl }
            : {}),
        },
        { updatedAt },
      ),
    );

    await this.sourcePublishers.save(sourcePublisher);

    return sourcePublisher;
  }
}
