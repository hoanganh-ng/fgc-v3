import { loadValidatedSourcePublisherById } from "../content-validation";
import type { SourcePublisherRepository } from "../ports/source-publisher-repository.port";
import type { SourcePublisher, SourcePublisherId } from "../../domain";

export interface GetSourcePublisherInput {
  readonly sourcePublisherId: SourcePublisherId;
}

export class GetSourcePublisherUseCase {
  public constructor(
    private readonly sourcePublishers: SourcePublisherRepository,
  ) {}

  public async execute(input: GetSourcePublisherInput): Promise<SourcePublisher> {
    return loadValidatedSourcePublisherById(
      this.sourcePublishers,
      input.sourcePublisherId,
    );
  }
}
