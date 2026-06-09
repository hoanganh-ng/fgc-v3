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
const PROFILE_MANAGER_HTTP_ERROR = "PROFILE_MANAGER_HTTP_ERROR";
const PROFILE_MANAGER_NETWORK_ERROR = "PROFILE_MANAGER_NETWORK_ERROR";
const PROFILE_MANAGER_RESPONSE_ERROR = "PROFILE_MANAGER_RESPONSE_ERROR";

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
    _input: ProfileCheckoutInput,
  ): Promise<ProfileCheckoutResult> {
    try {
      const response = await this.fetchImplementation(
        buildCheckoutProfileUrl(this.baseUrl),
        {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({}),
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

function buildReleaseProfileLeaseUrl(baseUrl: string, leaseId: string): string {
  return buildUrl(
    baseUrl,
    `collector/profile-leases/${encodeURIComponent(leaseId)}/release`,
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

function errorToProfileManagerMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Profile Manager request failed for an unknown reason.";
}
