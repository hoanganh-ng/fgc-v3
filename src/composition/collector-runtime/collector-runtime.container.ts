import {
  CancelAccountExerciseRunUseCase,
  CancelCollectionRunUseCase,
  AttachAccountExerciseRunLeaseUseCase,
  ClaimNextAccountExerciseRunUseCase,
  ClaimNextCollectionRunUseCase,
  ClaimNextProfileSourceAccessCheckRunUseCase,
  DispatchNextDueCollectionScheduleUseCase,
  GetAccountExerciseRunUseCase,
  GetCollectionRunUseCase,
  GetCollectionScheduleUseCase,
  ListAccountExerciseRunsUseCase,
  ListCollectionRunsUseCase,
  ListCollectionSchedulesUseCase,
  MarkAccountExerciseRunFailedUseCase,
  MarkAccountExerciseRunRunningUseCase,
  MarkAccountExerciseRunSucceededUseCase,
  MarkCollectionRunFailedUseCase,
  MarkCollectionRunRunningUseCase,
  MarkCollectionRunSucceededUseCase,
  RequestAccountExerciseRunUseCase,
  RequestCollectionRunUseCase,
  RequestProfileSourceAccessCheckRunUseCase,
  GetProfileSourceAccessCheckRunUseCase,
  ListProfileSourceAccessCheckRunsUseCase,
  MarkProfileSourceAccessCheckRunFailedUseCase,
  MarkProfileSourceAccessCheckRunRunningUseCase,
  MarkProfileSourceAccessCheckRunSucceededUseCase,
  CancelProfileSourceAccessCheckRunUseCase,
  UpsertCollectionScheduleUseCase,
} from "../../collector-runtime/application";
import type {
  AccountExerciseRunRepository,
  Clock,
  CollectionRunRepository,
  CollectionScheduleRepository,
  DispatchNextDueCollectionScheduleRepositoryPort,
  IdGenerator,
  SourceGroupLookupPort,
  ProfileSourceAccessCheckRunRepository,
  ProfileReferencePort,
} from "../../collector-runtime/application";

export interface CollectorRuntimeDependencies {
  readonly accountExerciseRuns: AccountExerciseRunRepository;
  readonly collectionRuns: CollectionRunRepository;
  readonly collectionSchedules: CollectionScheduleRepository;
  readonly dispatchNextDueCollectionSchedules: DispatchNextDueCollectionScheduleRepositoryPort;
  readonly checkRuns: ProfileSourceAccessCheckRunRepository;
  readonly profiles: ProfileReferencePort;
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
  readonly attachAccountExerciseRunLease: AttachAccountExerciseRunLeaseUseCase;
  readonly cancelAccountExerciseRun: CancelAccountExerciseRunUseCase;
  readonly requestCollectionRun: RequestCollectionRunUseCase;
  readonly getCollectionRun: GetCollectionRunUseCase;
  readonly listCollectionRuns: ListCollectionRunsUseCase;
  readonly markCollectionRunRunning: MarkCollectionRunRunningUseCase;
  readonly markCollectionRunSucceeded: MarkCollectionRunSucceededUseCase;
  readonly markCollectionRunFailed: MarkCollectionRunFailedUseCase;
  readonly cancelCollectionRun: CancelCollectionRunUseCase;
  readonly upsertCollectionSchedule: UpsertCollectionScheduleUseCase;
  readonly getCollectionSchedule: GetCollectionScheduleUseCase;
  readonly listCollectionSchedules: ListCollectionSchedulesUseCase;
  readonly dispatchNextDueCollectionSchedule: DispatchNextDueCollectionScheduleUseCase;
  readonly requestProfileSourceAccessCheckRun: RequestProfileSourceAccessCheckRunUseCase;
  readonly getProfileSourceAccessCheckRun: GetProfileSourceAccessCheckRunUseCase;
  readonly listProfileSourceAccessCheckRuns: ListProfileSourceAccessCheckRunsUseCase;
  readonly markProfileSourceAccessCheckRunRunning: MarkProfileSourceAccessCheckRunRunningUseCase;
  readonly markProfileSourceAccessCheckRunSucceeded: MarkProfileSourceAccessCheckRunSucceededUseCase;
  readonly markProfileSourceAccessCheckRunFailed: MarkProfileSourceAccessCheckRunFailedUseCase;
  readonly cancelProfileSourceAccessCheckRun: CancelProfileSourceAccessCheckRunUseCase;
  readonly claimNextAccountExerciseRun: ClaimNextAccountExerciseRunUseCase;
  readonly claimNextCollectionRun: ClaimNextCollectionRunUseCase;
  readonly claimNextProfileSourceAccessCheckRun: ClaimNextProfileSourceAccessCheckRunUseCase;
  close(): Promise<void>;
}

export function createCollectorRuntime(
  dependencies: CollectorRuntimeDependencies,
): CollectorRuntimeContainer {
  const {
    accountExerciseRuns,
    collectionRuns,
    collectionSchedules,
    dispatchNextDueCollectionSchedules,
    checkRuns,
    profiles,
    sourceGroups,
    clock,
    idGenerator,
  } = dependencies;

  return {
    requestAccountExerciseRun: new RequestAccountExerciseRunUseCase(
      accountExerciseRuns,
      sourceGroups,
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
    attachAccountExerciseRunLease: new AttachAccountExerciseRunLeaseUseCase(
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
    upsertCollectionSchedule: new UpsertCollectionScheduleUseCase(
      collectionSchedules,
      sourceGroups,
      clock,
    ),
    getCollectionSchedule: new GetCollectionScheduleUseCase(
      collectionSchedules,
    ),
    listCollectionSchedules: new ListCollectionSchedulesUseCase(
      collectionSchedules,
    ),
    dispatchNextDueCollectionSchedule: new DispatchNextDueCollectionScheduleUseCase(
      dispatchNextDueCollectionSchedules,
      clock,
      idGenerator,
    ),
    requestProfileSourceAccessCheckRun: new RequestProfileSourceAccessCheckRunUseCase(
      checkRuns,
      profiles,
      sourceGroups,
      idGenerator,
      clock,
    ),
    getProfileSourceAccessCheckRun: new GetProfileSourceAccessCheckRunUseCase(
      checkRuns,
    ),
    listProfileSourceAccessCheckRuns: new ListProfileSourceAccessCheckRunsUseCase(
      checkRuns,
    ),
    markProfileSourceAccessCheckRunRunning: new MarkProfileSourceAccessCheckRunRunningUseCase(
      checkRuns,
      clock,
    ),
    markProfileSourceAccessCheckRunSucceeded: new MarkProfileSourceAccessCheckRunSucceededUseCase(
      checkRuns,
      clock,
    ),
    markProfileSourceAccessCheckRunFailed: new MarkProfileSourceAccessCheckRunFailedUseCase(
      checkRuns,
      clock,
    ),
    cancelProfileSourceAccessCheckRun: new CancelProfileSourceAccessCheckRunUseCase(
      checkRuns,
      clock,
    ),
    claimNextAccountExerciseRun: new ClaimNextAccountExerciseRunUseCase(
      accountExerciseRuns,
      clock,
    ),
    claimNextCollectionRun: new ClaimNextCollectionRunUseCase(
      collectionRuns,
      clock,
    ),
    claimNextProfileSourceAccessCheckRun: new ClaimNextProfileSourceAccessCheckRunUseCase(
      checkRuns,
      clock,
    ),
    close: dependencies.close ?? noopClose,
  };
}

async function noopClose(): Promise<void> {}
