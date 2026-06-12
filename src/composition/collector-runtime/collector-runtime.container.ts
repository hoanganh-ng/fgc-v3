import {
  CancelAccountExerciseRunUseCase,
  CancelCollectionRunUseCase,
  ClaimNextCollectionRunUseCase,
  GetAccountExerciseRunUseCase,
  GetCollectionRunUseCase,
  ListAccountExerciseRunsUseCase,
  ListCollectionRunsUseCase,
  MarkAccountExerciseRunFailedUseCase,
  MarkAccountExerciseRunRunningUseCase,
  MarkAccountExerciseRunSucceededUseCase,
  MarkCollectionRunFailedUseCase,
  MarkCollectionRunRunningUseCase,
  MarkCollectionRunSucceededUseCase,
  RequestAccountExerciseRunUseCase,
  RequestCollectionRunUseCase,
} from "../../collector-runtime/application";
import type {
  AccountExerciseRunRepository,
  Clock,
  CollectionRunRepository,
  IdGenerator,
  SourceGroupLookupPort,
} from "../../collector-runtime/application";

export interface CollectorRuntimeDependencies {
  readonly accountExerciseRuns: AccountExerciseRunRepository;
  readonly collectionRuns: CollectionRunRepository;
  readonly sourceGroups: SourceGroupLookupPort;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly close?: () => Promise<void>;
}

export interface CollectorRuntimeContainer {
  readonly requestAccountExerciseRun: RequestAccountExerciseRunUseCase;
  readonly getAccountExerciseRun: GetAccountExerciseRunUseCase;
  readonly listAccountExerciseRuns: ListAccountExerciseRunsUseCase;
  readonly markAccountExerciseRunRunning: MarkAccountExerciseRunRunningUseCase;
  readonly markAccountExerciseRunSucceeded: MarkAccountExerciseRunSucceededUseCase;
  readonly markAccountExerciseRunFailed: MarkAccountExerciseRunFailedUseCase;
  readonly cancelAccountExerciseRun: CancelAccountExerciseRunUseCase;
  readonly requestCollectionRun: RequestCollectionRunUseCase;
  readonly getCollectionRun: GetCollectionRunUseCase;
  readonly listCollectionRuns: ListCollectionRunsUseCase;
  readonly markCollectionRunRunning: MarkCollectionRunRunningUseCase;
  readonly markCollectionRunSucceeded: MarkCollectionRunSucceededUseCase;
  readonly markCollectionRunFailed: MarkCollectionRunFailedUseCase;
  readonly cancelCollectionRun: CancelCollectionRunUseCase;
  readonly claimNextCollectionRun: ClaimNextCollectionRunUseCase;
  close(): Promise<void>;
}

export function createCollectorRuntime(
  dependencies: CollectorRuntimeDependencies,
): CollectorRuntimeContainer {
  const {
    accountExerciseRuns,
    collectionRuns,
    sourceGroups,
    clock,
    idGenerator,
  } = dependencies;

  return {
    requestAccountExerciseRun: new RequestAccountExerciseRunUseCase(
      accountExerciseRuns,
      idGenerator,
      clock,
    ),
    getAccountExerciseRun: new GetAccountExerciseRunUseCase(
      accountExerciseRuns,
    ),
    listAccountExerciseRuns: new ListAccountExerciseRunsUseCase(
      accountExerciseRuns,
    ),
    markAccountExerciseRunRunning: new MarkAccountExerciseRunRunningUseCase(
      accountExerciseRuns,
      clock,
    ),
    markAccountExerciseRunSucceeded: new MarkAccountExerciseRunSucceededUseCase(
      accountExerciseRuns,
      clock,
    ),
    markAccountExerciseRunFailed: new MarkAccountExerciseRunFailedUseCase(
      accountExerciseRuns,
      clock,
    ),
    cancelAccountExerciseRun: new CancelAccountExerciseRunUseCase(
      accountExerciseRuns,
      clock,
    ),
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
    claimNextCollectionRun: new ClaimNextCollectionRunUseCase(
      collectionRuns,
      clock,
    ),
    close: dependencies.close ?? noopClose,
  };
}

async function noopClose(): Promise<void> {}
