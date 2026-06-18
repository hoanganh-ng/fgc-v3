import {
  toIsoDateTime,
  validateSourcePublisherForApplication,
} from "../content-validation";
import type { Clock } from "../ports/clock.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { SourcePublisherRepository } from "../ports/source-publisher-repository.port";
import { observeSourcePublisher } from "../../domain";
import type {
  ContentPlatform,
  ExternalPublisherId,
  SourcePublisher,
  SourcePublisherKind,
} from "../../domain";

export interface ObserveSourcePublisherInput {
  readonly platform: ContentPlatform;
  readonly kind: SourcePublisherKind;
  readonly externalPublisherId: ExternalPublisherId;
  readonly observedAt: SourcePublisher["lastObservedAt"];
  readonly displayName?: string;
  readonly canonicalUrl?: string;
}

export class ObserveSourcePublisherUseCase {
  public constructor(
    private readonly sourcePublishers: SourcePublisherRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: ObserveSourcePublisherInput,
  ): Promise<SourcePublisher> {
    const updatedAt = toIsoDateTime(this.clock.now());
    const existing = await this.sourcePublishers.findByIdentity(
      input.platform,
      input.kind,
      input.externalPublisherId,
    );

    const id = existing?.id ?? (await this.ids.generateId());

    const sourcePublisher = validateSourcePublisherForApplication(
      observeSourcePublisher(
        existing,
        {
          id,
          identity: {
            platform: input.platform,
            kind: input.kind,
            externalPublisherId: input.externalPublisherId,
          },
          observedAt: input.observedAt,
          ...(input.displayName !== undefined
            ? { displayName: input.displayName }
            : {}),
          ...(input.canonicalUrl !== undefined
            ? { canonicalUrl: input.canonicalUrl }
            : {}),
        },
        { updatedAt },
      ),
    );

    await this.sourcePublishers.save(sourcePublisher);

    return sourcePublisher;
  }
}
