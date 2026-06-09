const CONFIGURATION_PATH_PREFIX = "collector/provisioning";
const CONFIGURATION_PATH_SUFFIX = "configuration";
const SESSION_PATH_SUFFIX = "session";
const PROFILE_PROVISIONING_HTTP_ERROR = "PROFILE_PROVISIONING_HTTP_ERROR";
const PROFILE_PROVISIONING_NETWORK_ERROR = "PROFILE_PROVISIONING_NETWORK_ERROR";
const PROFILE_PROVISIONING_RESPONSE_ERROR =
  "PROFILE_PROVISIONING_RESPONSE_ERROR";

export interface FetchLikeRequestInit {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

export interface FetchLikeResponse {
  readonly status: number;
  json?(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchLike = (
  input: string,
  init?: FetchLikeRequestInit,
) => Promise<FetchLikeResponse>;

export interface ProfileProvisioningHttpClientConfig {
  readonly baseUrl: string;
}

export interface ProfileProvisioningHttpClientOptions {
  readonly fetchImplementation?: FetchLike;
}

export type ProvisioningProxyProtocol = "HTTP" | "HTTPS" | "SOCKS5";
export type ProvisioningCookieSameSite = "STRICT" | "LAX" | "NONE";

export interface ProvisioningProxyCredentials {
  readonly username: string;
  readonly password: string;
}

export interface ProvisioningProxyRouting {
  readonly protocol: ProvisioningProxyProtocol;
  readonly host: string;
  readonly port: number;
  readonly credentials?: ProvisioningProxyCredentials | null;
  readonly countryCode?: string;
  readonly region?: string;
}

export interface ProvisioningNetworkKillswitch {
  readonly enabled: boolean;
  readonly failClosed: boolean;
}

export interface ProvisioningNetworkContext {
  readonly proxy: ProvisioningProxyRouting | null;
  readonly killswitch: ProvisioningNetworkKillswitch;
}

export interface ProvisioningViewport {
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor?: number;
}

export interface ProvisioningHardwareFingerprint {
  readonly userAgent: string;
  readonly viewport: ProvisioningViewport;
  readonly languages: readonly string[];
  readonly hardwareConcurrency: number;
  readonly platform?: string;
  readonly deviceMemoryGb?: number;
  readonly timezone?: string;
}

export interface ProvisioningConfiguration {
  readonly profileId: string;
  readonly networkContext: ProvisioningNetworkContext;
  readonly hardwareFingerprint: ProvisioningHardwareFingerprint;
}

export interface ProvisioningBrowserCookie {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expiresAt: string | null;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite?: ProvisioningCookieSameSite;
}

export interface ProvisioningLocalStorageEntry {
  readonly origin: string;
  readonly key: string;
  readonly value: string;
}

export interface ProvisioningCapturedSessionState {
  readonly cookies: readonly ProvisioningBrowserCookie[];
  readonly localStorage: readonly ProvisioningLocalStorageEntry[];
  readonly sessionExpiresAt?: string | null;
}

export interface ProvisioningProfileSummary {
  readonly id: string;
  readonly status: string;
  readonly hasAuthenticationState?: boolean;
  readonly provisioningTokenStatus?: string;
}

export interface ProvisioningHttpIssue {
  readonly path: string;
  readonly message: string;
}

export interface ProvisioningHttpFailure {
  readonly ok: false;
  readonly statusCode?: number;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly issues?: readonly ProvisioningHttpIssue[];
}

export type ProvisioningConfigurationResult =
  | {
      readonly ok: true;
      readonly configuration: ProvisioningConfiguration;
    }
  | ProvisioningHttpFailure;

export type ProvisioningSessionIngestionResult =
  | {
      readonly ok: true;
      readonly profile: ProvisioningProfileSummary;
    }
  | ProvisioningHttpFailure;

export class ProfileProvisioningHttpClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: FetchLike;

  public constructor(
    config: ProfileProvisioningHttpClientConfig,
    options: ProfileProvisioningHttpClientOptions = {},
  ) {
    this.baseUrl = config.baseUrl.trim();
    this.fetchImplementation =
      options.fetchImplementation ?? createGlobalFetchAdapter();
  }

  public async getProvisioningConfiguration(
    provisioningToken: string,
  ): Promise<ProvisioningConfigurationResult> {
    try {
      const response = await this.fetchImplementation(
        buildProvisioningConfigurationUrl(this.baseUrl, provisioningToken),
        {
          method: "GET",
          headers: jsonHeaders(),
        },
      );

      if (!isSuccessStatusCode(response.status)) {
        return readHttpFailure(response, [provisioningToken]);
      }

      const body = await readJsonBody(response);
      const configuration = toProvisioningConfiguration(body);

      if (configuration === undefined) {
        return {
          ok: false,
          statusCode: response.status,
          errorCode: PROFILE_PROVISIONING_RESPONSE_ERROR,
          errorMessage:
            "Profile Manager provisioning configuration response is invalid.",
        };
      }

      return {
        ok: true,
        configuration,
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: PROFILE_PROVISIONING_NETWORK_ERROR,
        errorMessage: errorToSafeMessage(error, [provisioningToken]),
      };
    }
  }

  public async ingestSessionState(
    provisioningToken: string,
    sessionState: ProvisioningCapturedSessionState,
  ): Promise<ProvisioningSessionIngestionResult> {
    try {
      const response = await this.fetchImplementation(
        buildProvisioningSessionUrl(this.baseUrl, provisioningToken),
        {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify(toSessionIngestionRequestBody(sessionState)),
        },
      );

      if (!isSuccessStatusCode(response.status)) {
        return readHttpFailure(response, [provisioningToken]);
      }

      const body = await readJsonBody(response);
      const profile = toProvisioningProfileSummary(body);

      if (profile === undefined) {
        return {
          ok: false,
          statusCode: response.status,
          errorCode: PROFILE_PROVISIONING_RESPONSE_ERROR,
          errorMessage:
            "Profile Manager session ingestion response is invalid.",
        };
      }

      return {
        ok: true,
        profile,
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: PROFILE_PROVISIONING_NETWORK_ERROR,
        errorMessage: errorToSafeMessage(error, [provisioningToken]),
      };
    }
  }
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

function buildProvisioningConfigurationUrl(
  baseUrl: string,
  provisioningToken: string,
): string {
  return buildProvisioningUrl(
    baseUrl,
    provisioningToken,
    CONFIGURATION_PATH_SUFFIX,
  );
}

function buildProvisioningSessionUrl(
  baseUrl: string,
  provisioningToken: string,
): string {
  return buildProvisioningUrl(baseUrl, provisioningToken, SESSION_PATH_SUFFIX);
}

function buildProvisioningUrl(
  baseUrl: string,
  provisioningToken: string,
  suffix: string,
): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const path = `${CONFIGURATION_PATH_PREFIX}/${encodeURIComponent(
    provisioningToken,
  )}/${suffix}`;

  return new URL(path, normalizedBaseUrl).toString();
}

function jsonHeaders(): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
  };
}

function isSuccessStatusCode(statusCode: number): boolean {
  return statusCode >= 200 && statusCode <= 299;
}

function toSessionIngestionRequestBody(
  sessionState: ProvisioningCapturedSessionState,
): Record<string, unknown> {
  return {
    cookies: sessionState.cookies,
    localStorage: sessionState.localStorage,
    ...(sessionState.sessionExpiresAt !== undefined
      ? { sessionExpiresAt: sessionState.sessionExpiresAt }
      : {}),
  };
}

function toProvisioningConfiguration(
  body: unknown,
): ProvisioningConfiguration | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const profileId = readNonEmptyString(body.profileId);
  const networkContext = toNetworkContext(body.networkContext);
  const hardwareFingerprint = toHardwareFingerprint(body.hardwareFingerprint);

  if (
    profileId === undefined ||
    networkContext === undefined ||
    hardwareFingerprint === undefined
  ) {
    return undefined;
  }

  return {
    profileId,
    networkContext,
    hardwareFingerprint,
  };
}

function toNetworkContext(
  value: unknown,
): ProvisioningNetworkContext | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const proxy = toProxyRouting(value.proxy);
  const killswitch = toNetworkKillswitch(value.killswitch);

  if (proxy === undefined || killswitch === undefined) {
    return undefined;
  }

  return {
    proxy,
    killswitch,
  };
}

function toNetworkKillswitch(
  value: unknown,
): ProvisioningNetworkKillswitch | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.enabled !== "boolean" || typeof value.failClosed !== "boolean") {
    return undefined;
  }

  return {
    enabled: value.enabled,
    failClosed: value.failClosed,
  };
}

function toProxyRouting(
  value: unknown,
): ProvisioningProxyRouting | null | undefined {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const protocol = toProxyProtocol(value.protocol);
  const host = readNonEmptyString(value.host);
  const port = toPort(value.port);

  if (protocol === undefined || host === undefined || port === undefined) {
    return undefined;
  }

  const credentials = toProxyCredentials(value.credentials);
  const countryCode = readOptionalNonEmptyString(value.countryCode);
  const region = readOptionalNonEmptyString(value.region);

  if (credentials === undefined && "credentials" in value) {
    return undefined;
  }

  return {
    protocol,
    host,
    port,
    ...(credentials !== undefined ? { credentials } : {}),
    ...(countryCode !== undefined ? { countryCode } : {}),
    ...(region !== undefined ? { region } : {}),
  };
}

function toProxyProtocol(
  value: unknown,
): ProvisioningProxyProtocol | undefined {
  if (value === "HTTP" || value === "HTTPS" || value === "SOCKS5") {
    return value;
  }

  return undefined;
}

function toPort(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 65535
    ? Number(value)
    : undefined;
}

function toProxyCredentials(
  value: unknown,
): ProvisioningProxyCredentials | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const username = readNonEmptyString(value.username);
  const password = readNonEmptyString(value.password);

  if (username === undefined || password === undefined) {
    return undefined;
  }

  return {
    username,
    password,
  };
}

function toHardwareFingerprint(
  value: unknown,
): ProvisioningHardwareFingerprint | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const userAgent = readNonEmptyString(value.userAgent);
  const viewport = toViewport(value.viewport);
  const languages = toNonEmptyStringArray(value.languages);
  const hardwareConcurrency = toPositiveNumber(value.hardwareConcurrency);

  if (
    userAgent === undefined ||
    viewport === undefined ||
    languages === undefined ||
    hardwareConcurrency === undefined
  ) {
    return undefined;
  }

  const platform = readOptionalNonEmptyString(value.platform);
  const deviceMemoryGb = toOptionalPositiveNumber(value.deviceMemoryGb);
  const timezone = readOptionalNonEmptyString(value.timezone);

  return {
    userAgent,
    viewport,
    languages,
    hardwareConcurrency,
    ...(platform !== undefined ? { platform } : {}),
    ...(deviceMemoryGb !== undefined ? { deviceMemoryGb } : {}),
    ...(timezone !== undefined ? { timezone } : {}),
  };
}

function toViewport(value: unknown): ProvisioningViewport | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const width = toPositiveNumber(value.width);
  const height = toPositiveNumber(value.height);
  const deviceScaleFactor = toOptionalPositiveNumber(value.deviceScaleFactor);

  if (width === undefined || height === undefined) {
    return undefined;
  }

  return {
    width,
    height,
    ...(deviceScaleFactor !== undefined ? { deviceScaleFactor } : {}),
  };
}

function toProvisioningProfileSummary(
  body: unknown,
): ProvisioningProfileSummary | undefined {
  if (!isRecord(body) || !isRecord(body.profile)) {
    return undefined;
  }

  const id = readNonEmptyString(body.profile.id);
  const status = readNonEmptyString(body.profile.status);

  if (id === undefined || status === undefined) {
    return undefined;
  }

  const hasAuthenticationState =
    typeof body.profile.hasAuthenticationState === "boolean"
      ? body.profile.hasAuthenticationState
      : undefined;
  const provisioningTokenStatus = readOptionalNonEmptyString(
    body.profile.provisioningTokenStatus,
  );

  return {
    id,
    status,
    ...(hasAuthenticationState !== undefined ? { hasAuthenticationState } : {}),
    ...(provisioningTokenStatus !== undefined
      ? { provisioningTokenStatus }
      : {}),
  };
}

async function readHttpFailure(
  response: FetchLikeResponse,
  secrets: readonly string[],
): Promise<ProvisioningHttpFailure> {
  const fallbackMessage = `Profile Manager responded with HTTP ${response.status}.`;

  try {
    const responseText = (await response.text()).trim();

    if (responseText.length === 0) {
      return {
        ok: false,
        statusCode: response.status,
        errorCode: PROFILE_PROVISIONING_HTTP_ERROR,
        errorMessage: fallbackMessage,
      };
    }

    const parsedBody: unknown = JSON.parse(responseText);

    if (isRecord(parsedBody) && isRecord(parsedBody.error)) {
      const errorCode = readNonEmptyString(parsedBody.error.code);
      const errorMessage = readNonEmptyString(parsedBody.error.message);
      const issues = toHttpIssues(parsedBody.error.issues, secrets);

      return {
        ok: false,
        statusCode: response.status,
        errorCode: errorCode ?? PROFILE_PROVISIONING_HTTP_ERROR,
        errorMessage:
          errorMessage === undefined
            ? fallbackMessage
            : redactSensitiveText(errorMessage, secrets),
        ...(issues !== undefined ? { issues } : {}),
      };
    }

    return {
      ok: false,
      statusCode: response.status,
      errorCode: PROFILE_PROVISIONING_HTTP_ERROR,
      errorMessage: fallbackMessage,
    };
  } catch {
    return {
      ok: false,
      statusCode: response.status,
      errorCode: PROFILE_PROVISIONING_HTTP_ERROR,
      errorMessage: fallbackMessage,
    };
  }
}

function toHttpIssues(
  value: unknown,
  secrets: readonly string[],
): readonly ProvisioningHttpIssue[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const issues: ProvisioningHttpIssue[] = [];

  for (const issue of value) {
    if (!isRecord(issue)) {
      continue;
    }

    const path = readNonEmptyString(issue.path);
    const message = readNonEmptyString(issue.message);

    if (path === undefined || message === undefined) {
      continue;
    }

    issues.push({
      path: redactSensitiveText(path, secrets),
      message: redactSensitiveText(message, secrets),
    });
  }

  return issues.length > 0 ? issues : undefined;
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

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function readOptionalNonEmptyString(value: unknown): string | undefined {
  return value === undefined ? undefined : readNonEmptyString(value);
}

function toNonEmptyStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );

  return values.length > 0 ? values : undefined;
}

function toPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function toOptionalPositiveNumber(value: unknown): number | undefined {
  return value === undefined ? undefined : toPositiveNumber(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorToSafeMessage(
  error: unknown,
  secrets: readonly string[],
): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return redactSensitiveText(error.message, secrets);
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return redactSensitiveText(error, secrets);
  }

  return "Profile Manager request failed for an unknown reason.";
}

function redactSensitiveText(
  text: string,
  secrets: readonly string[],
): string {
  let redactedText = text;

  for (const secret of secrets) {
    const normalizedSecret = secret.trim();

    if (normalizedSecret.length === 0) {
      continue;
    }

    redactedText = redactedText.split(normalizedSecret).join("[redacted]");
  }

  return redactedText;
}
