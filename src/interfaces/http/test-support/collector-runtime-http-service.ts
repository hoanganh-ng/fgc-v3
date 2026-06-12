import type {
  CollectionRun,
} from "../../../collector-runtime/domain";
import type {
  CollectorRuntimeHttpService,
} from "../routes/collector-runtime.routes";

export const collectorRuntimeHttpTestNow = "2026-04-01T10:00:00.000Z";

export class StubUseCase<Input, Output> {
  public readonly calls: Input[] = [];
  private error: unknown;

  public constructor(private output: Output) {}

  public setOutput(output: Output): void {
    this.output = output;
  }

  public setError(error: unknown): void {
    this.error = error;
  }

  public async execute(input: Input): Promise<Output> {
    this.calls.push(input);

    if (this.error !== undefined) {
      throw this.error;
    }

    return this.output;
  }
}

export interface FakeCollectorRuntimeHttpService
  extends CollectorRuntimeHttpService {
  readonly requestCollectionRun: StubUseCase<unknown, CollectionRun>;
  readonly getCollectionRun: StubUseCase<unknown, CollectionRun>;
  readonly listCollectionRuns: StubUseCase<
    unknown,
    {
      readonly items: readonly CollectionRun[];
      readonly page: {
        readonly limit: number;
        readonly offset: number;
        readonly total?: number;
      };
    }
  >;
  readonly cancelCollectionRun: StubUseCase<unknown, CollectionRun>;
}

export function createFakeCollectorRuntimeHttpService(): FakeCollectorRuntimeHttpService {
  const collectionRun = createCollectionRun();

  return {
    requestCollectionRun: new StubUseCase(collectionRun),
    getCollectionRun: new StubUseCase(collectionRun),
    listCollectionRuns: new StubUseCase({
      items: [collectionRun],
      page: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    }),
    cancelCollectionRun: new StubUseCase(
      createCollectionRun({
        status: "CANCELED",
        finishedAt: collectorRuntimeHttpTestNow,
        updatedAt: collectorRuntimeHttpTestNow,
      }),
    ),
  } as FakeCollectorRuntimeHttpService;
}

export function createUnusedCollectorRuntimeHttpService(): CollectorRuntimeHttpService {
  const useCase = {
    async execute(_input: unknown): Promise<unknown> {
      throw new Error("Collector Runtime service was not expected.");
    },
  };

  return {
    requestCollectionRun: useCase,
    getCollectionRun: useCase,
    listCollectionRuns: useCase,
    cancelCollectionRun: useCase,
  } as unknown as CollectorRuntimeHttpService;
}

export function createCollectionRun(
  options: Partial<CollectionRun> = {},
): CollectionRun {
  return {
    id: options.id ?? "collection-run-1",
    sourceGroupId: options.sourceGroupId ?? "source-group-1",
    status: options.status ?? "QUEUED",
    triggerType: options.triggerType ?? "MANUAL_API",
    parameters: options.parameters ?? {
      maxScrolls: 3,
      maxDurationMs: 30_000,
    },
    ...(options.summary !== undefined ? { summary: options.summary } : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? collectorRuntimeHttpTestNow,
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined
      ? { finishedAt: options.finishedAt }
      : {}),
    createdAt: options.createdAt ?? collectorRuntimeHttpTestNow,
    updatedAt: options.updatedAt ?? collectorRuntimeHttpTestNow,
  };
}
