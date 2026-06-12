import {
  CancelCollectionRunUseCase,
  GetCollectionRunUseCase,
  ListCollectionRunsUseCase,
  MarkCollectionRunFailedUseCase,
  MarkCollectionRunRunningUseCase,
  MarkCollectionRunSucceededUseCase,
  RequestCollectionRunUseCase,
} from "../../collector-runtime/application";
import type {
  Clock,
  CollectionRunRepository,
  IdGenerator,
  SourceGroupLookupPort,
} from "../../collector-runtime/application";

export interface CollectorRuntimeDependencies {
  readonly collectionRuns: CollectionRunRepository;
  readonly sourceGroups: SourceGroupLookupPort;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly close?: () => Promise<void>;
}

export interface CollectorRuntimeContainer {
  readonly requestCollectionRun: RequestCollectionRunUseCase;
  readonly getCollectionRun: GetCollectionRunUseCase;
  readonly listCollectionRuns: ListCollectionRunsUseCase;
  readonly markCollectionRunRunning: MarkCollectionRunRunningUseCase;
  readonly markCollectionRunSucceeded: MarkCollectionRunSucceededUseCase;
  readonly markCollectionRunFailed: MarkCollectionRunFailedUseCase;
  readonly cancelCollectionRun: CancelCollectionRunUseCase;
  close(): Promise<void>;
}

export function createCollectorRuntime(
  dependencies: CollectorRuntimeDependencies,
): CollectorRuntimeContainer {
  const {
    collectionRuns,
    sourceGroups,
    clock,
    idGenerator,
  } = dependencies;

  return {
    requestCollectionRun: new RequestCollectionRunUseCase(
      collectionRuns,
      sourceGroups,
      idGenerator,
      clock,
    ),
    getCollectionRun: new GetCollectionRunUseCase(collectionRuns),
    listCollectionRuns: new ListCollectionRunsUseCase(collectionRuns),
    markCollectionRunRunning: new MarkCollectionRunRunningUseCase(
      collectionRuns,
      clock,
    ),
    markCollectionRunSucceeded: new MarkCollectionRunSucceededUseCase(
      collectionRuns,
      clock,
    ),
    markCollectionRunFailed: new MarkCollectionRunFailedUseCase(
      collectionRuns,
      clock,
    ),
    cancelCollectionRun: new CancelCollectionRunUseCase(
      collectionRuns,
      clock,
    ),
    close: dependencies.close ?? noopClose,
  };
}

async function noopClose(): Promise<void> {}
