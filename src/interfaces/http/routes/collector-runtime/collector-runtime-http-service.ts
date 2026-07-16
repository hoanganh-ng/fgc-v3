import type {
  CancelAccountExerciseRunInput,
  CancelCollectionRunInput,
  CancelProfileHomeFeedCollectionRunInput,
  AttachAccountExerciseRunLeaseInput,
  GetAccountExerciseRunInput,
  GetCollectionRunInput,
  GetCollectionScheduleInput,
  CreateOrUpdateProfileHomeFeedCollectionScheduleInput,
  GetProfileHomeFeedCollectionRunInput,
  GetProfileHomeFeedCollectionScheduleInput,
  ListAccountExerciseRunsInput,
  ListAccountExerciseRunsOutput,
  ListCollectionRunsInput,
  ListCollectionRunsOutput,
  ListCollectionSchedulesInput,
  ListCollectionSchedulesOutput,
  ListProfileHomeFeedCollectionRunsInput,
  ListProfileHomeFeedCollectionRunsOutput,
  ListProfileHomeFeedCollectionSchedulesInput,
  ListProfileHomeFeedCollectionSchedulesOutput,
  MarkAccountExerciseRunFailedInput,
  MarkAccountExerciseRunRunningInput,
  MarkAccountExerciseRunSucceededInput,
  RequestAccountExerciseRunInput,
  RequestCollectionRunInput,
  RequestProfileHomeFeedCollectionRunInput,
  RequestProfileSourceAccessCheckRunInput,
  GetProfileSourceAccessCheckRunInput,
  ListProfileSourceAccessCheckRunsInput,
  ListProfileSourceAccessCheckRunsOutput,
  CancelProfileSourceAccessCheckRunInput,
  UpsertCollectionScheduleUseCaseInput,
} from "../../../../collector-runtime/application";
import type {
  AccountExerciseRun,
  CollectionRun,
  CollectionSchedule,
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionSchedule,
  ProfileSourceAccessCheckRun,
} from "../../../../collector-runtime/domain";

interface ExecutableUseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

export interface CollectorRuntimeHttpService {
  readonly requestAccountExerciseRun: ExecutableUseCase<
    RequestAccountExerciseRunInput,
    AccountExerciseRun
  >;
  readonly getAccountExerciseRun: ExecutableUseCase<
    GetAccountExerciseRunInput,
    AccountExerciseRun
  >;
  readonly listAccountExerciseRuns: ExecutableUseCase<
    ListAccountExerciseRunsInput,
    ListAccountExerciseRunsOutput
  >;
  readonly markAccountExerciseRunRunning: ExecutableUseCase<
    MarkAccountExerciseRunRunningInput,
    AccountExerciseRun
  >;
  readonly markAccountExerciseRunSucceeded: ExecutableUseCase<
    MarkAccountExerciseRunSucceededInput,
    AccountExerciseRun
  >;
  readonly markAccountExerciseRunFailed: ExecutableUseCase<
    MarkAccountExerciseRunFailedInput,
    AccountExerciseRun
  >;
  readonly attachAccountExerciseRunLease: ExecutableUseCase<
    AttachAccountExerciseRunLeaseInput,
    AccountExerciseRun
  >;
  readonly cancelAccountExerciseRun: ExecutableUseCase<
    CancelAccountExerciseRunInput,
    AccountExerciseRun
  >;
  readonly requestCollectionRun: ExecutableUseCase<
    RequestCollectionRunInput,
    CollectionRun
  >;
  readonly getCollectionRun: ExecutableUseCase<
    GetCollectionRunInput,
    CollectionRun
  >;
  readonly listCollectionRuns: ExecutableUseCase<
    ListCollectionRunsInput,
    ListCollectionRunsOutput
  >;
  readonly cancelCollectionRun: ExecutableUseCase<
    CancelCollectionRunInput,
    CollectionRun
  >;
  readonly requestProfileHomeFeedCollectionRun: ExecutableUseCase<
    RequestProfileHomeFeedCollectionRunInput,
    ProfileHomeFeedCollectionRun
  >;
  readonly getProfileHomeFeedCollectionRun: ExecutableUseCase<
    GetProfileHomeFeedCollectionRunInput,
    ProfileHomeFeedCollectionRun
  >;
  readonly listProfileHomeFeedCollectionRuns: ExecutableUseCase<
    ListProfileHomeFeedCollectionRunsInput,
    ListProfileHomeFeedCollectionRunsOutput
  >;
  readonly cancelProfileHomeFeedCollectionRun: ExecutableUseCase<
    CancelProfileHomeFeedCollectionRunInput,
    ProfileHomeFeedCollectionRun
  >;
  readonly requestProfileSourceAccessCheckRun: ExecutableUseCase<
    RequestProfileSourceAccessCheckRunInput,
    ProfileSourceAccessCheckRun
  >;
  readonly getProfileSourceAccessCheckRun: ExecutableUseCase<
    GetProfileSourceAccessCheckRunInput,
    ProfileSourceAccessCheckRun
  >;
  readonly listProfileSourceAccessCheckRuns: ExecutableUseCase<
    ListProfileSourceAccessCheckRunsInput,
    ListProfileSourceAccessCheckRunsOutput
  >;
  readonly cancelProfileSourceAccessCheckRun: ExecutableUseCase<
    CancelProfileSourceAccessCheckRunInput,
    ProfileSourceAccessCheckRun
  >;
  readonly upsertCollectionSchedule: ExecutableUseCase<
    UpsertCollectionScheduleUseCaseInput,
    CollectionSchedule
  >;
  readonly getCollectionSchedule: ExecutableUseCase<
    GetCollectionScheduleInput,
    CollectionSchedule
  >;
  readonly listCollectionSchedules: ExecutableUseCase<
    ListCollectionSchedulesInput,
    ListCollectionSchedulesOutput
  >;
  readonly createOrUpdateProfileHomeFeedCollectionSchedule: ExecutableUseCase<
    CreateOrUpdateProfileHomeFeedCollectionScheduleInput,
    ProfileHomeFeedCollectionSchedule
  >;
  readonly getProfileHomeFeedCollectionSchedule: ExecutableUseCase<
    GetProfileHomeFeedCollectionScheduleInput,
    ProfileHomeFeedCollectionSchedule
  >;
  readonly listProfileHomeFeedCollectionSchedules: ExecutableUseCase<
    ListProfileHomeFeedCollectionSchedulesInput,
    ListProfileHomeFeedCollectionSchedulesOutput
  >;
}

export interface RegisterCollectorRuntimeRoutesOptions {
  readonly collectorRuntime: CollectorRuntimeHttpService;
}
