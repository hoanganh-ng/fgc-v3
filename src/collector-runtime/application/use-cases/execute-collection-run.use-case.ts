import { InvalidCollectionRunStatusTransitionError } from "../application-errors";
import {
  loadValidatedCollectionRunById,
  toCollectionRunIsoDateTime,
  validateCollectionRunFailureReasonForApplication,
  validateCollectionRunForApplication,
  validateCollectionRunSummaryForApplication,
} from "../collection-run-validation";
import type { Clock } from "../ports/clock.port";
import type { CollectionRunExecutorPort } from "../ports/collection-run-executor.port";
import type { CollectionRunRepository } from "../ports/collection-run-repository.port";
import type {
  CollectionRun,
  CollectionRunFailureReason,
  CollectionRunId,
  CollectionRunSummary,
} from "../../domain";

export interface ExecuteCollectionRunInput {
  readonly collectionRunId: CollectionRunId;
}

export class ExecuteCollectionRunUseCase {
  public constructor(
    private readonly collectionRuns: CollectionRunRepository,
    private readonly executor: CollectionRunExecutorPort,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: ExecuteCollectionRunInput,
  ): Promise<CollectionRun> {
    const collectionRun = await loadValidatedCollectionRunById(
      this.collectionRuns,
      input.collectionRunId,
    );

    assertCollectionRunIsRunning(collectionRun);

    const executionResult = await executeSafely(this.executor, collectionRun);
    const now = toCollectionRunIsoDateTime(this.clock.now());

    if (executionResult.ok) {
      const { failureReason: _failureReason, ...runWithoutFailureReason } =
        collectionRun;
      const summary = validateCollectionRunSummaryForApplication(
        executionResult.summary,
      );
      const updatedCollectionRun = validateCollectionRunForApplication({
        ...runWithoutFailureReason,
        status: "SUCCEEDED",
        summary,
        finishedAt: now,
        updatedAt: now,
      });

      await this.collectionRuns.save(updatedCollectionRun);

      return updatedCollectionRun;
    }

    const failureReason = validateCollectionRunFailureReasonForApplication(
      executionResult.failureReason,
    );
    const summary = normalizeOptionalSummary(executionResult.summary);
    const updatedCollectionRun = validateCollectionRunForApplication({
      ...collectionRun,
      status: "FAILED",
      ...(summary !== undefined ? { summary } : {}),
      failureReason,
      finishedAt: now,
      updatedAt: now,
    });

    await this.collectionRuns.save(updatedCollectionRun);

    return updatedCollectionRun;
  }
}

function assertCollectionRunIsRunning(collectionRun: CollectionRun): void {
  if (collectionRun.status !== "RUNNING") {
    throw new InvalidCollectionRunStatusTransitionError(
      collectionRun.status,
      "SUCCEEDED",
    );
  }
}

async function executeSafely(
  executor: CollectionRunExecutorPort,
  collectionRun: CollectionRun,
): Promise<
  | { readonly ok: true; readonly summary: CollectionRunSummary }
  | {
      readonly ok: false;
      readonly failureReason: CollectionRunFailureReason;
      readonly summary?: CollectionRunSummary;
    }
> {
  try {
    return await executor.execute({
      collectionRunId: collectionRun.id,
      sourceGroupId: collectionRun.sourceGroupId,
      parameters: collectionRun.parameters,
    });
  } catch {
    return {
      ok: false,
      failureReason: {
        code: "COLLECTION_RUN_EXECUTOR_FAILED",
        message: "Collection run executor failed.",
      },
    };
  }
}

function normalizeOptionalSummary(
  summary: CollectionRunSummary | undefined,
): CollectionRunSummary | undefined {
  return summary === undefined
    ? undefined
    : validateCollectionRunSummaryForApplication(summary);
}
