import { validateCollectionRunForApplication } from "../collection-run-validation";
import {
  toCollectionScheduleIsoDateTime,
  validateCollectionScheduleForApplication,
} from "../collection-schedule-validation";
import type {
  DispatchNextDueCollectionScheduleInput,
  DispatchNextDueCollectionScheduleRepositoryPort,
  DispatchNextDueCollectionScheduleResult,
} from "../ports/dispatch-next-due-collection-schedule-repository.port";
import type { Clock } from "../ports/clock.port";
import type { IdGenerator } from "../ports/id-generator.port";
import type { CollectionRunId } from "../../domain";

export class DispatchNextDueCollectionScheduleUseCase {
  public constructor(
    private readonly dispatcher:
      DispatchNextDueCollectionScheduleRepositoryPort,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  public async execute(): Promise<DispatchNextDueCollectionScheduleResult | null> {
    const dispatchAt = toCollectionScheduleIsoDateTime(this.clock.now());
    const collectionRunId =
      (await this.idGenerator.generateId()) as CollectionRunId;

    const input: DispatchNextDueCollectionScheduleInput = {
      dispatchAt,
      collectionRunId,
    };

    const result = await this.dispatcher.dispatchNextDue(input);

    if (result === null) {
      return null;
    }

    return {
      schedule: validateCollectionScheduleForApplication(result.schedule),
      collectionRun: validateCollectionRunForApplication(result.collectionRun),
    };
  }
}