import type {
  ProfileCheckoutInput,
  ProfileCheckoutResult,
  ProfileLeasePort,
  ProfileLeaseReleaseInput,
  ProfileLeaseReleaseResult,
  RuntimeProfileConfigurationPort,
  RuntimeProfileConfigurationResult,
} from "../application";
import type {
  FetchLike,
  FetchLikeResponse,
} from "./content-manager-http-client";

const CHECKOUT_PROFILE_PATH = "collector/profiles/checkout";
const PROFILES_PATH = "collector/profiles";
const PROFILE_MANAGER_HTTP_ERROR = "PROFILE_MANAGER_HTTP_ERROR";
const PROFILE_MANAGER_NETWORK_ERROR = "PROFILE_MANAGER_NETWORK_ERROR";
const PROFILE_MANAGER_RESPONSE_ERROR = "PROFILE_MANAGER_RESPONSE_ERROR";
const DIAGNOSTIC_PROFILE_STATUSES = [
  "READY",
  "BUSY",
  "PENDING_LOGIN",
  "PENDING_CONFIG",
] as const;

export interface ProfileManagerHttpClientEnvironment {
  readonly PROFILE_MANAGER_BASE_URL?: string;
}

export interface ProfileManagerHttpClientConfig {
  readonly baseUrl: string;
}

export class MissingProfileManagerHttpClientConfigError extends Error {
  public constructor(public readonly key: keyof ProfileManagerHttpClientEnvironment) {
    super(`${key} is required for Profile Manager HTTP client configuration.`);
    this.name = "MissingProfileManagerHttpClientConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function loadProfileManagerHttpClientConfig(
  environment: ProfileManagerHttpClientEnvironment = process.env,
): ProfileManagerHttpClientConfig {
  const baseUrl = environment.PROFILE_MANAGER_BASE_URL?.trim();

  if (baseUrl === undefined || baseUrl === "") {
    throw new MissingProfileManagerHttpClientConfigError(
      "PROFILE_MANAGER_BASE_URL",
    );
  }

  return {
    baseUrl,
  };
}

export interface ProfileManagerHttpClientOptions {
  readonly fetchImplementation?: FetchLike;
}

export interface SafeProfileStatusCounts {
  readonly total: number;
  readonly READY: number;
  readonly BUSY: number;
  readonly PENDING_LOGIN: number;
  readonly PENDING_CONFIG: number;
}

export type SafeProfileStatusCountsResult =
  | {
      readonly ok: true;
      readonly counts: SafeProfileStatusCounts;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export type SafeProfileAccountStageResult =
  | {
      readonly ok: true;
      readonly profileId: string;
      readonly accountStage: string;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export type ProfileExerciseCheckoutResult =
  | {
      readonly ok: true;
      readonly profileId: string;
      readonly accountStage: string;
      readonly leaseId: string;
      readonly leaseExpiresAt?: string;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export type ProfileAssistedGroupAccessCheckoutResult = ProfileExerciseCheckoutResult;

export type ProfileSourceAccessReportableState =
  | "PUBLIC_ACCESSIBLE"
  | "JOIN_REQUIRED"
  | "JOINED_ACCESSIBLE"
  | "ACCESS_DENIED"
  | "LOGIN_REQUIRED"
  | "CHECKPOINT_REQUIRED";

export interface UpsertProfileSourceAccessInput {
  readonly profileId: string;
  readonly sourceGroupId: string;
  readonly accessState: ProfileSourceAccessReportableState;
  readonly lastFailureReason: {
    readonly code: string;
    readonly message: string;
  } | null;
}

export type UpsertProfileSourceAccessResult =
  | {
      readonly ok: true;
      readonly profileId: string;
      readonly sourceGroupId: string;
      readonly accessState: ProfileSourceAccessReportableState;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

interface HttpFailure {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export class ProfileManagerHttpClient
  implements ProfileLeasePort, RuntimeProfileConfigurationPort {
  private readonly baseUrl: string;
  private readonly fetchImplementation: FetchLike;

  public constructor(
    config: ProfileManagerHttpClientConfig,
    options: ProfileManagerHttpClientOptions = {},
  ) {
    this.baseUrl = config.baseUrl.trim();
    this.fetchImplementation =
      options.fetchImplementation ?? createGlobalFetchAdapter();
  }

  public async checkoutProfile(
    input: ProfileCheckoutInput,
  ): Promise<ProfileCheckoutResult> {
    try {
      const response = await this.fetchImplementation(
        buildCheckoutProfileUrl(this.baseUrl),
        {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({ sourceGroupId: input.sourceGroupId }),
        },
      );

      if (!isSuccessStatusCode(response.status)) {
        return toCheckoutFailure(await readHttpFailure(response));
      }

      const body = await readJsonBody(response);
      const result = toCheckoutSuccessResult(body);

      if (result !== undefined) {
        return result;
      }

      return {
        ok: false,
        statusCode: response.status,
        errorCode: PROFILE_MANAGER_RESPONSE_ERROR,
        errorMessage: "Profile Manager checkout response is invalid.",
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: PROFILE_MANAGER_NETWORK_ERROR,
        errorMessage: errorToProfileManagerMessage(error),
      };
    }
  }

  public async checkoutProfileForExercise(
    profileId: string,
  ): Promise<ProfileExerciseCheckoutResult> {
    try {
      const response = await this.fetchImplementation(
        buildCheckoutProfileForExerciseUrl(this.baseUrl, profileId),
        {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({}),
        },
      );

      if (!isSuccessStatusCode(response.status)) {
        return toExerciseCheckoutFailure(await readHttpFailure(response));
      }

      const body = await readJsonBody(response);
      const result = toExerciseCheckoutSuccessResult(body);

      if (result !== undefined) {
        return result;
      }

      return {
        ok: false,
        statusCode: response.status,
        errorCode: PROFILE_MANAGER_RESPONSE_ERROR,
        errorMessage: "Profile Manager exercise checkout response is invalid.",
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: PROFILE_MANAGER_NETWORK_ERROR,
        errorMessage: errorToProfileManagerMessage(error),
      };
    }
  }

  public async checkoutProfileForAssistedGroupAccess(
    profileId: string,
    sourceGroupId: string,
  ): Promise<ProfileAssistedGroupAccessCheckoutResult> {
    try {
      const response = await this.fetchImplementation(
        buildCheckoutProfileForAssistedGroupAccessUrl(this.baseUrl, profileId),
        {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({ sourceGroupId }),
        },
      );

      if (!isSuccessStatusCode(response.status)) {
        return toAssistedGroupAccessCheckoutFailure(await readHttpFailure(response));
      }

      const body = await readJsonBody(response);
      const result = toExerciseCheckoutSuccessResult(body);

      if (result !== undefined) {
        return result;
      }

      return {
        ok: false,
        statusCode: response.status,
        errorCode: PROFILE_MANAGER_RESPONSE_ERROR,
        errorMessage:
          "Profile Manager assisted group access checkout response is invalid.",
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: PROFILE_MANAGER_NETWORK_ERROR,
        errorMessage: errorToProfileManagerMessage(error),
      };
    }
  }

  public async releaseProfileLease(
    input: ProfileLeaseReleaseInput,
  ): Promise<ProfileLeaseReleaseResult> {
    try {
      const response = await this.fetchImplementation(
        buildReleaseProfileLeaseUrl(this.baseUrl, input.leaseId),
        {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify(toReleaseProfileLeaseRequestBody(input)),
        },
      );

      if (!isSuccessStatusCode(response.status)) {
        return toReleaseFailure(await readHttpFailure(response));
      }

      const body = await readJsonBody(response);
      const result = toReleaseSuccessResult(body);

      if (result !== undefined) {
        return result;
      }

      return {
        ok: false,
        statusCode: response.status,
        errorCode: PROFILE_MANAGER_RESPONSE_ERROR,
        errorMessage: "Profile Manager release response is invalid.",
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: PROFILE_MANAGER_NETWORK_ERROR,
        errorMessage: errorToProfileManagerMessage(error),
      };
    }
  }

  public async getRuntimeProfileConfiguration(
    leaseId: string,
  ): Promise<RuntimeProfileConfigurationResult> {
    try {
      const response = await this.fetchImplementation(
        buildRuntimeProfileConfigurationUrl(this.baseUrl, leaseId),
        {
          method: "GET",
          headers: jsonHeaders(),
        },
      );

      if (!isSuccessStatusCode(response.status)) {
        return toRuntimeProfileConfigurationFailure(
          await readHttpFailure(response),
        );
      }

      const body = await readJsonBody(response);
      const result = toRuntimeProfileConfigurationSuccessResult(body);

      if (result !== undefined) {
        return result;
      }

      return {
        ok: false,
        statusCode: response.status,
        errorCode: PROFILE_MANAGER_RESPONSE_ERROR,
        errorMessage:
          "Profile Manager runtime configuration response is invalid.",
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: PROFILE_MANAGER_NETWORK_ERROR,
        errorMessage: errorToProfileManagerMessage(error),
      };
    }
  }

  public async upsertProfileSourceAccess(
    input: UpsertProfileSourceAccessInput,
  ): Promise<UpsertProfileSourceAccessResult> {
    try {
      const response = await this.fetchImplementation(
        buildProfileSourceAccessUrl(
          this.baseUrl,
          input.profileId,
          input.sourceGroupId,
        ),
        {
          method: "PUT",
          headers: jsonHeaders(),
          body: JSON.stringify({
            accessState: input.accessState,
            lastFailureReason: input.lastFailureReason,
          }),
        },
      );

      if (response.status !== 200 && response.status !== 201) {
        return toUpsertProfileSourceAccessFailure(
          readSanitizedHttpFailure(response),
        );
      }

      const body = await readJsonBody(response);
      const result = toUpsertProfileSourceAccessSuccessResult(input, body);

      if (result !== undefined) {
        return result;
      }

      return {
        ok: false,
        statusCode: response.status,
        errorCode: PROFILE_MANAGER_RESPONSE_ERROR,
        errorMessage: "Profile Manager profile-source access response is invalid.",
      };
    } catch {
      return {
        ok: false,
        errorCode: PROFILE_MANAGER_NETWORK_ERROR,
        errorMessage: "Profile Manager profile-source access request failed.",
      };
    }
  }

  public async getSafeProfileAccountStage(
    profileId: string,
  ): Promise<SafeProfileAccountStageResult> {
    try {
      const response = await this.fetchImplementation(
        buildProfileUrl(this.baseUrl, profileId),
        {
          method: "GET",
          headers: jsonHeaders(),
        },
      );

      if (!isSuccessStatusCode(response.status)) {
        return toSafeProfileAccountStageFailure(await readHttpFailure(response));
      }

      const body = await readJsonBody(response);
      const result = toSafeProfileAccountStageSuccessResult(body);

      if (result !== undefined) {
        return result;
      }

      return {
        ok: false,
        statusCode: response.status,
        errorCode: PROFILE_MANAGER_RESPONSE_ERROR,
        errorMessage: "Profile Manager profile response is invalid.",
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: PROFILE_MANAGER_NETWORK_ERROR,
        errorMessage: errorToProfileManagerMessage(error),
      };
    }
  }

  public async getSafeProfileStatusCounts(): Promise<SafeProfileStatusCountsResult> {
    const totalResult = await this.readSafeProfileCount();

    if (!totalResult.ok) {
      return totalResult;
    }

    const statusCounts: Partial<Record<
      (typeof DIAGNOSTIC_PROFILE_STATUSES)[number],
      number
    >> = {};

    for (const status of DIAGNOSTIC_PROFILE_STATUSES) {
      const statusCountResult = await this.readSafeProfileCount(status);

      if (!statusCountResult.ok) {
        return statusCountResult;
      }

      statusCounts[status] = statusCountResult.count;
    }

    return {
      ok: true,
      counts: {
        total: totalResult.count,
        READY: statusCounts.READY ?? 0,
        BUSY: statusCounts.BUSY ?? 0,
        PENDING_LOGIN: statusCounts.PENDING_LOGIN ?? 0,
        PENDING_CONFIG: statusCounts.PENDING_CONFIG ?? 0,
      },
    };
  }

  private async readSafeProfileCount(
    status?: (typeof DIAGNOSTIC_PROFILE_STATUSES)[number],
  ): Promise<
    | {
        readonly ok: true;
        readonly count: number;
      }
    | {
        readonly ok: false;
        readonly statusCode?: number;
        readonly errorCode: string;
        readonly errorMessage: string;
      }
  > {
    try {
      const response = await this.fetchImplementation(
        buildProfilesUrl(this.baseUrl, status),
        {
          method: "GET",
          headers: jsonHeaders(),
        },
      );

      if (!isSuccessStatusCode(response.status)) {
        return toSafeProfileStatusCountsFailure(await readHttpFailure(response));
      }

      const count = toProfileListCount(await readJsonBody(response));

      if (count !== undefined) {
        return {
          ok: true,
          count,
        };
      }

      return {
        ok: false,
        statusCode: response.status,
        errorCode: PROFILE_MANAGER_RESPONSE_ERROR,
        errorMessage: "Profile Manager profile list response is invalid.",
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: PROFILE_MANAGER_NETWORK_ERROR,
        errorMessage: errorToProfileManagerMessage(error),
      };
    }
  }
}

export function createProfileManagerHttpClientFromEnv(
  environment: ProfileManagerHttpClientEnvironment = process.env,
  options: ProfileManagerHttpClientOptions = {},
): ProfileManagerHttpClient {
  return new ProfileManagerHttpClient(
    loadProfileManagerHttpClientConfig(environment),
    options,
  );
}

function createGlobalFetchAdapter(): FetchLike {
  return async (input, init) => {
    const globalFetch = (globalThis as { readonly fetch?: FetchLike }).fetch;

    if (globalFetch === undefined) {
      throw new Error("A fetch implementation is required.");
    }

    return globalFetch(input, init);
  };
}

function jsonHeaders(): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
  };
}

function buildCheckoutProfileUrl(baseUrl: string): string {
  return buildUrl(baseUrl, CHECKOUT_PROFILE_PATH);
}

function buildProfilesUrl(
  baseUrl: string,
  status?: (typeof DIAGNOSTIC_PROFILE_STATUSES)[number],
): string {
  const url = new URL(buildUrl(baseUrl, PROFILES_PATH));

  if (status !== undefined) {
    url.searchParams.set("status", status);
  }

  url.searchParams.set("limit", "1");
  url.searchParams.set("offset", "0");

  return url.toString();
}

function buildProfileUrl(baseUrl: string, profileId: string): string {
  return buildUrl(baseUrl, `collector/profiles/${encodeURIComponent(profileId)}`);
}

function buildReleaseProfileLeaseUrl(baseUrl: string, leaseId: string): string {
  return buildUrl(
    baseUrl,
    `collector/profile-leases/${encodeURIComponent(leaseId)}/release`,
  );
}

function buildCheckoutProfileForExerciseUrl(
  baseUrl: string,
  profileId: string,
): string {
  return buildUrl(
    baseUrl,
    `collector/profiles/${encodeURIComponent(profileId)}/exercise-checkout`,
  );
}

function buildCheckoutProfileForAssistedGroupAccessUrl(
  baseUrl: string,
  profileId: string,
): string {
  return buildUrl(
    baseUrl,
    `collector/profiles/${encodeURIComponent(profileId)}/assisted-group-access/checkout`,
  );
}

function buildRuntimeProfileConfigurationUrl(
  baseUrl: string,
  leaseId: string,
): string {
  return buildUrl(
    baseUrl,
    `collector/profile-leases/${encodeURIComponent(leaseId)}/runtime-configuration`,
  );
}

function buildProfileSourceAccessUrl(
  baseUrl: string,
  profileId: string,
  sourceGroupId: string,
): string {
  return buildUrl(
    baseUrl,
    `collector/profiles/${encodeURIComponent(profileId)}/source-access/${encodeURIComponent(sourceGroupId)}`,
  );
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL(path, normalizedBaseUrl).toString();
}

function isSuccessStatusCode(statusCode: number): boolean {
  return statusCode >= 200 && statusCode <= 299;
}

function toReleaseProfileLeaseRequestBody(
  input: ProfileLeaseReleaseInput,
): Record<string, number> {
  return {
    ...(input.macroActionsPerformed !== undefined
      ? { macroActionsPerformed: input.macroActionsPerformed }
      : {}),
  };
}

function toCheckoutSuccessResult(
  body: unknown,
): Extract<ProfileCheckoutResult, { readonly ok: true }> | undefined {
  if (!isRecord(body) || !isRecord(body.lease) || !isRecord(body.profile)) {
    return undefined;
  }

  const leaseId = body.lease.id;
  const leaseExpiresAt = body.lease.expiresAt;
  const profileId = body.profile.profileId;

  if (typeof leaseId !== "string" || leaseId.trim().length === 0) {
    return undefined;
  }

  if (typeof profileId !== "string" || profileId.trim().length === 0) {
    return undefined;
  }

  return {
    ok: true,
    profileId,
    leaseId,
    ...(typeof leaseExpiresAt === "string" && leaseExpiresAt.trim().length > 0
      ? { leaseExpiresAt }
      : {}),
  };
}

function toExerciseCheckoutSuccessResult(
  body: unknown,
): Extract<ProfileExerciseCheckoutResult, { readonly ok: true }> | undefined {
  if (!isRecord(body) || !isRecord(body.lease) || !isRecord(body.profile)) {
    return undefined;
  }

  const leaseId = body.lease.id;
  const leaseExpiresAt = body.lease.expiresAt;
  const profileId = body.profile.profileId;
  const accountStage = body.profile.accountStage;

  if (typeof leaseId !== "string" || leaseId.trim().length === 0) {
    return undefined;
  }

  if (typeof profileId !== "string" || profileId.trim().length === 0) {
    return undefined;
  }

  if (typeof accountStage !== "string" || accountStage.trim().length === 0) {
    return undefined;
  }

  return {
    ok: true,
    profileId,
    accountStage,
    leaseId,
    ...(typeof leaseExpiresAt === "string" && leaseExpiresAt.trim().length > 0
      ? { leaseExpiresAt }
      : {}),
  };
}

function toSafeProfileAccountStageSuccessResult(
  body: unknown,
): Extract<SafeProfileAccountStageResult, { readonly ok: true }> | undefined {
  if (!isRecord(body) || !isRecord(body.profile)) {
    return undefined;
  }

  const profileId = body.profile.id;
  const accountStage = body.profile.accountStage;

  if (typeof profileId !== "string" || profileId.trim().length === 0) {
    return undefined;
  }

  if (typeof accountStage !== "string" || accountStage.trim().length === 0) {
    return undefined;
  }

  return {
    ok: true,
    profileId,
    accountStage,
  };
}

function toReleaseSuccessResult(
  body: unknown,
): Extract<ProfileLeaseReleaseResult, { readonly ok: true }> | undefined {
  if (!isRecord(body) || !isRecord(body.lease)) {
    return undefined;
  }

  const releasedAt = body.lease.releasedAt;

  return {
    ok: true,
    ...(typeof releasedAt === "string" && releasedAt.trim().length > 0
      ? { releasedAt }
      : {}),
  };
}

function toRuntimeProfileConfigurationSuccessResult(
  body: unknown,
):
  | Extract<RuntimeProfileConfigurationResult, { readonly ok: true }>
  | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const profileId = body.profileId;
  const leaseId = body.leaseId;

  if (typeof profileId !== "string" || profileId.trim().length === 0) {
    return undefined;
  }

  if (typeof leaseId !== "string" || leaseId.trim().length === 0) {
    return undefined;
  }

  if (
    !isRecord(body.hardwareFingerprint) ||
    !isRecord(body.networkContext) ||
    !isRecord(body.authenticationState)
  ) {
    return undefined;
  }

  const leaseExpiresAt = body.leaseExpiresAt;

  return {
    ok: true,
    configuration: {
      profileId,
      leaseId,
      ...(typeof leaseExpiresAt === "string" &&
      leaseExpiresAt.trim().length > 0
        ? { leaseExpiresAt }
        : {}),
      hardwareFingerprint: body.hardwareFingerprint,
      networkContext: body.networkContext,
      authenticationState: body.authenticationState,
      ...(isRecord(body.temporalRoutine)
        ? { temporalRoutine: body.temporalRoutine }
        : {}),
      ...(isRecord(body.safetyThresholds)
        ? { safetyThresholds: body.safetyThresholds }
        : {}),
      ...(isRecord(body.contentAffinities)
        ? { contentAffinities: body.contentAffinities }
        : {}),
    },
  };
}

function toUpsertProfileSourceAccessSuccessResult(
  input: UpsertProfileSourceAccessInput,
  body: unknown,
): Extract<UpsertProfileSourceAccessResult, { readonly ok: true }> | undefined {
  if (!isRecord(body) || !isRecord(body.profileSourceAccess)) {
    return undefined;
  }

  const profileId = body.profileSourceAccess.profileId;
  const sourceGroupId = body.profileSourceAccess.sourceGroupId;
  const accessState = body.profileSourceAccess.accessState;

  if (profileId !== input.profileId || sourceGroupId !== input.sourceGroupId) {
    return undefined;
  }

  if (accessState !== input.accessState) {
    return undefined;
  }

  if (!isProfileSourceAccessReportableState(accessState)) {
    return undefined;
  }

  return {
    ok: true,
    profileId,
    sourceGroupId,
    accessState,
  };
}

function toProfileListCount(body: unknown): number | undefined {
  if (!isRecord(body) || !Array.isArray(body.items) || !isRecord(body.page)) {
    return undefined;
  }

  const total = body.page.total;

  if (typeof total === "number" && Number.isInteger(total) && total >= 0) {
    return total;
  }

  return body.items.length;
}

function toSafeProfileStatusCountsFailure(
  failure: HttpFailure,
): Extract<SafeProfileStatusCountsResult, { readonly ok: false }> {
  return {
    ok: false,
    statusCode: failure.statusCode,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
  };
}

function toSafeProfileAccountStageFailure(
  failure: HttpFailure,
): Extract<SafeProfileAccountStageResult, { readonly ok: false }> {
  return {
    ok: false,
    statusCode: failure.statusCode,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
  };
}

function toExerciseCheckoutFailure(
  failure: HttpFailure,
): Extract<ProfileExerciseCheckoutResult, { readonly ok: false }> {
  return {
    ok: false,
    statusCode: failure.statusCode,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
  };
}

function toAssistedGroupAccessCheckoutFailure(
  failure: HttpFailure,
): Extract<ProfileAssistedGroupAccessCheckoutResult, { readonly ok: false }> {
  return {
    ok: false,
    statusCode: failure.statusCode,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
  };
}

function toCheckoutFailure(
  failure: HttpFailure,
): Extract<ProfileCheckoutResult, { readonly ok: false }> {
  return {
    ok: false,
    statusCode: failure.statusCode,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
  };
}

function toReleaseFailure(
  failure: HttpFailure,
): Extract<ProfileLeaseReleaseResult, { readonly ok: false }> {
  return {
    ok: false,
    statusCode: failure.statusCode,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
  };
}

function toRuntimeProfileConfigurationFailure(
  failure: HttpFailure,
): Extract<RuntimeProfileConfigurationResult, { readonly ok: false }> {
  return {
    ok: false,
    statusCode: failure.statusCode,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
  };
}

function toUpsertProfileSourceAccessFailure(
  failure: HttpFailure,
): Extract<UpsertProfileSourceAccessResult, { readonly ok: false }> {
  return {
    ok: false,
    statusCode: failure.statusCode,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
  };
}

function readSanitizedHttpFailure(response: FetchLikeResponse): HttpFailure {
  return {
    statusCode: response.status,
    errorCode: PROFILE_MANAGER_HTTP_ERROR,
    errorMessage: `Profile Manager responded with HTTP ${response.status}.`,
  };
}

async function readHttpFailure(response: FetchLikeResponse): Promise<HttpFailure> {
  const fallbackMessage = `Profile Manager responded with HTTP ${response.status}.`;

  try {
    const responseText = (await response.text()).trim();

    if (responseText.length === 0) {
      return {
        statusCode: response.status,
        errorCode: PROFILE_MANAGER_HTTP_ERROR,
        errorMessage: fallbackMessage,
      };
    }

    const parsedBody: unknown = JSON.parse(responseText);

    if (isRecord(parsedBody) && isRecord(parsedBody.error)) {
      const errorCode = parsedBody.error.code;
      const errorMessage = parsedBody.error.message;

      return {
        statusCode: response.status,
        errorCode:
          typeof errorCode === "string" && errorCode.trim().length > 0
            ? errorCode
            : PROFILE_MANAGER_HTTP_ERROR,
        errorMessage:
          typeof errorMessage === "string" && errorMessage.trim().length > 0
            ? errorMessage
            : fallbackMessage,
      };
    }

    return {
      statusCode: response.status,
      errorCode: PROFILE_MANAGER_HTTP_ERROR,
      errorMessage: responseText,
    };
  } catch {
    return {
      statusCode: response.status,
      errorCode: PROFILE_MANAGER_HTTP_ERROR,
      errorMessage: fallbackMessage,
    };
  }
}

async function readJsonBody(response: FetchLikeResponse): Promise<unknown> {
  if (response.json !== undefined) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  try {
    return JSON.parse(await response.text());
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProfileSourceAccessReportableState(
  value: unknown,
): value is ProfileSourceAccessReportableState {
  return (
    value === "PUBLIC_ACCESSIBLE" ||
    value === "JOIN_REQUIRED" ||
    value === "JOINED_ACCESSIBLE" ||
    value === "ACCESS_DENIED" ||
    value === "LOGIN_REQUIRED" ||
    value === "CHECKPOINT_REQUIRED"
  );
}

function errorToProfileManagerMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Profile Manager request failed for an unknown reason.";
}
