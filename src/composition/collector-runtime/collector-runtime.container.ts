import {
  CancelAccountExerciseRunUseCase,
  CancelCollectionRunUseCase,
  AttachAccountExerciseRunLeaseUseCase,
  ClaimNextAccountExerciseRunUseCase,
  ClaimNextCollectionRunUseCase,
  ClaimNextProfileHomeFeedCollectionRunUseCase,
  ClaimNextProfileSourceAccessCheckRunUseCase,
  CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase,
  DispatchNextDueCollectionScheduleUseCase,
  DispatchNextDueProfileHomeFeedCollectionScheduleUseCase,
  GetAccountExerciseRunUseCase,
  GetCollectionRunUseCase,
  GetCollectionScheduleUseCase,
  GetProfileHomeFeedCollectionRunUseCase,
  GetProfileHomeFeedCollectionScheduleUseCase,
  ListAccountExerciseRunsUseCase,
  ListCollectionRunsUseCase,
  ListCollectionSchedulesUseCase,
  ListProfileHomeFeedCollectionRunsUseCase,
  ListProfileHomeFeedCollectionSchedulesUseCase,
  MarkAccountExerciseRunFailedUseCase,
  MarkAccountExerciseRunRunningUseCase,
  MarkAccountExerciseRunSucceededUseCase,
  MarkCollectionRunFailedUseCase,
  MarkCollectionRunRunningUseCase,
  MarkCollectionRunSucceededUseCase,
  MarkProfileHomeFeedCollectionRunFailedUseCase,
  MarkProfileHomeFeedCollectionRunSucceededUseCase,
  RequestAccountExerciseRunUseCase,
  RequestCollectionRunUseCase,
  RequestProfileHomeFeedCollectionRunUseCase,
  RequestProfileSourceAccessCheckRunUseCase,
  GetProfileSourceAccessCheckRunUseCase,
  ListProfileSourceAccessCheckRunsUseCase,
  MarkProfileSourceAccessCheckRunFailedUseCase,
  MarkProfileSourceAccessCheckRunRunningUseCase,
  MarkProfileSourceAccessCheckRunSucceededUseCase,
  CancelProfileSourceAccessCheckRunUseCase,
  CancelProfileHomeFeedCollectionRunUseCase,
  UpsertCollectionScheduleUseCase,
} from "../../collector-runtime/application";
import type {
  AccountExerciseRunRepository,
  Clock,
  CollectionRunRepository,
  CollectionScheduleRepository,
  DispatchNextDueCollectionScheduleRepositoryPort,
  DispatchNextDueProfileHomeFeedCollectionScheduleRepositoryPort,
  IdGenerator,
  ProfileHomeFeedCollectionScheduleRepository,
  SourceGroupLookupPort,
  ProfileHomeFeedCollectionRunRepository,
  ProfileSourceAccessCheckRunRepository,
  ProfileReferencePort,
} from "../../collector-runtime/application";

export interface CollectorRuntimeDependencies {
  readonly accountExerciseRuns: AccountExerciseRunRepository;
  readonly collectionRuns: CollectionRunRepository;
  readonly collectionSchedules: CollectionScheduleRepository;
  readonly homeFeedSchedules: ProfileHomeFeedCollectionScheduleRepository;
  readonly dispatchNextDueCollectionSchedules: DispatchNextDueCollectionScheduleRepositoryPort;
  readonly dispatchNextDueProfileHomeFeedCollectionSchedules: DispatchNextDueProfileHomeFeedCollectionScheduleRepositoryPort;
  readonly homeFeedRuns: ProfileHomeFeedCollectionRunRepository;
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
  readonly createOrUpdateProfileHomeFeedCollectionSchedule: CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase;
  readonly getProfileHomeFeedCollectionSchedule: GetProfileHomeFeedCollectionScheduleUseCase;
  readonly listProfileHomeFeedCollectionSchedules: ListProfileHomeFeedCollectionSchedulesUseCase;
  readonly dispatchNextDueCollectionSchedule: DispatchNextDueCollectionScheduleUseCase;
  readonly dispatchNextDueProfileHomeFeedCollectionSchedule: DispatchNextDueProfileHomeFeedCollectionScheduleUseCase;
  readonly requestProfileHomeFeedCollectionRun: RequestProfileHomeFeedCollectionRunUseCase;
  readonly getProfileHomeFeedCollectionRun: GetProfileHomeFeedCollectionRunUseCase;
  readonly listProfileHomeFeedCollectionRuns: ListProfileHomeFeedCollectionRunsUseCase;
  readonly markProfileHomeFeedCollectionRunSucceeded: MarkProfileHomeFeedCollectionRunSucceededUseCase;
  readonly markProfileHomeFeedCollectionRunFailed: MarkProfileHomeFeedCollectionRunFailedUseCase;
  readonly cancelProfileHomeFeedCollectionRun: CancelProfileHomeFeedCollectionRunUseCase;
  readonly requestProfileSourceAccessCheckRun: RequestProfileSourceAccessCheckRunUseCase;
  readonly getProfileSourceAccessCheckRun: GetProfileSourceAccessCheckRunUseCase;
  readonly listProfileSourceAccessCheckRuns: ListProfileSourceAccessCheckRunsUseCase;
  readonly markProfileSourceAccessCheckRunRunning: MarkProfileSourceAccessCheckRunRunningUseCase;
  readonly markProfileSourceAccessCheckRunSucceeded: MarkProfileSourceAccessCheckRunSucceededUseCase;
  readonly markProfileSourceAccessCheckRunFailed: MarkProfileSourceAccessCheckRunFailedUseCase;
  readonly cancelProfileSourceAccessCheckRun: CancelProfileSourceAccessCheckRunUseCase;
  readonly claimNextAccountExerciseRun: ClaimNextAccountExerciseRunUseCase;
  readonly claimNextCollectionRun: ClaimNextCollectionRunUseCase;
  readonly claimNextProfileHomeFeedCollectionRun: ClaimNextProfileHomeFeedCollectionRunUseCase;
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
    homeFeedSchedules,
    dispatchNextDueCollectionSchedules,
    dispatchNextDueProfileHomeFeedCollectionSchedules,
    homeFeedRuns,
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
    createOrUpdateProfileHomeFeedCollectionSchedule:
      new CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase(
        homeFeedSchedules,
        profiles,
        clock,
      ),
    getProfileHomeFeedCollectionSchedule:
      new GetProfileHomeFeedCollectionScheduleUseCase(homeFeedSchedules),
    listProfileHomeFeedCollectionSchedules:
      new ListProfileHomeFeedCollectionSchedulesUseCase(homeFeedSchedules),
    dispatchNextDueCollectionSchedule: new DispatchNextDueCollectionScheduleUseCase(
      dispatchNextDueCollectionSchedules,
      clock,
      idGenerator,
    ),
    dispatchNextDueProfileHomeFeedCollectionSchedule:
      new DispatchNextDueProfileHomeFeedCollectionScheduleUseCase(
        dispatchNextDueProfileHomeFeedCollectionSchedules,
        profiles,
        clock,
        idGenerator,
      ),
    requestProfileHomeFeedCollectionRun: new RequestProfileHomeFeedCollectionRunUseCase(
      homeFeedRuns,
      profiles,
      idGenerator,
      clock,
    ),
    getProfileHomeFeedCollectionRun: new GetProfileHomeFeedCollectionRunUseCase(
      homeFeedRuns,
    ),
    listProfileHomeFeedCollectionRuns: new ListProfileHomeFeedCollectionRunsUseCase(
      homeFeedRuns,
    ),
    markProfileHomeFeedCollectionRunSucceeded: new MarkProfileHomeFeedCollectionRunSucceededUseCase(
      homeFeedRuns,
      clock,
    ),
    markProfileHomeFeedCollectionRunFailed: new MarkProfileHomeFeedCollectionRunFailedUseCase(
      homeFeedRuns,
      clock,
    ),
    cancelProfileHomeFeedCollectionRun: new CancelProfileHomeFeedCollectionRunUseCase(
      homeFeedRuns,
      clock,
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
    claimNextProfileHomeFeedCollectionRun: new ClaimNextProfileHomeFeedCollectionRunUseCase(
      homeFeedRuns,
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
