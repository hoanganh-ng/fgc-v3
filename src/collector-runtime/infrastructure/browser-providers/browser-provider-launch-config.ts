import {
  BrowserProviderError,
  type BrowserProviderLaunchConfig,
  type BrowserProviderLocalStorageOrigin,
  type BrowserProviderName,
  type BrowserProviderProxySettings,
  type BrowserProviderStorageCookie,
  type BrowserProviderStorageState,
} from "../../application";
import type { RuntimeProfileConfiguration } from "../../application";

export interface BuildBrowserProviderLaunchConfigInput {
  readonly providerName: BrowserProviderName;
  readonly configuration: RuntimeProfileConfiguration;
  readonly headless: boolean;
}

export function buildBrowserProviderLaunchConfig(
  input: BuildBrowserProviderLaunchConfigInput,
): BrowserProviderLaunchConfig {
  const configuration = input.configuration;
  const hardwareFingerprint = requireRecord(
    configuration.hardwareFingerprint,
    "hardwareFingerprint",
  );
  const networkContext = requireRecord(
    configuration.networkContext,
    "networkContext",
  );
  const authenticationState = requireRecord(
    configuration.authenticationState,
    "authenticationState",
  );
  const storageState = toStorageState(authenticationState);
  const viewport = toRecord(hardwareFingerprint.viewport);
  const viewportWidth = readPositiveNumber(viewport, "width");
  const viewportHeight = readPositiveNumber(viewport, "height");
  const deviceScaleFactor = readPositiveNumber(viewport, "deviceScaleFactor");
  const languages = readStringArray(hardwareFingerprint, "languages");
  const firstLanguage = languages[0];
  const userAgent = readString(hardwareFingerprint, "userAgent");
  const timezone =
    readString(hardwareFingerprint, "timezone") ??
    readString(toRecord(configuration.temporalRoutine), "timezone");
  const profileOwnedFingerprintSeed =
    readString(hardwareFingerprint, "fingerprintSeed") ??
    readString(hardwareFingerprint, "seed");

  return {
    providerName: input.providerName,
    profileId: configuration.profileId,
    leaseId: configuration.leaseId,
    headless: input.headless,
    storageState,
    ...(toBrowserProviderProxySettings(toRecord(networkContext.proxy)) ?? {}),
    ...(viewportWidth !== undefined && viewportHeight !== undefined
      ? {
          viewport: {
            width: Math.round(viewportWidth),
            height: Math.round(viewportHeight),
          },
        }
      : {}),
    ...(deviceScaleFactor !== undefined ? { deviceScaleFactor } : {}),
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(firstLanguage !== undefined
      ? {
          locale: firstLanguage,
          acceptLanguageHeader: languages.join(","),
        }
      : {}),
    ...(timezone !== undefined ? { timezoneId: timezone } : {}),
    fingerprint: {
      seed: profileOwnedFingerprintSeed ?? configuration.profileId,
      source:
        profileOwnedFingerprintSeed === undefined
          ? "PROFILE_ID"
          : "PROFILE_MANAGER",
      profileOwnedConfig: configuration.hardwareFingerprint,
    },
  };
}

function toBrowserProviderProxySettings(
  proxy: Record<string, unknown> | undefined,
): { readonly proxy?: BrowserProviderProxySettings } | undefined {
  if (proxy === undefined || proxy === null) {
    return undefined;
  }

  const protocol = readString(proxy, "protocol");
  const host = readString(proxy, "host");
  const port = readPositiveNumber(proxy, "port");

  if (protocol === undefined || host === undefined || port === undefined) {
    throw new BrowserProviderError(
      "BROWSER_PROVIDER_CONFIGURATION_INVALID",
      "Runtime profile proxy configuration is incomplete.",
    );
  }

  const credentials = toRecord(proxy.credentials);
  const username = readString(credentials, "username");
  const password = readString(credentials, "password");

  if (
    (username === undefined && password !== undefined) ||
    (username !== undefined && password === undefined)
  ) {
    throw new BrowserProviderError(
      "BROWSER_PROVIDER_CONFIGURATION_INVALID",
      "Runtime profile proxy credentials are incomplete.",
    );
  }

  return {
    proxy: {
      server: `${toProxyScheme(protocol)}://${host}:${Math.round(port)}`,
      ...(username !== undefined && password !== undefined
        ? {
            username,
            password,
          }
        : {}),
    },
  };
}

function toStorageState(
  authenticationState: Record<string, unknown>,
): BrowserProviderStorageState {
  return {
    cookies: readUnknownArray(authenticationState, "cookies")
      .map(toBrowserProviderStorageCookie)
      .filter(
        (cookie): cookie is BrowserProviderStorageCookie =>
          cookie !== undefined,
      ),
    origins: toLocalStorageOrigins(
      readUnknownArray(authenticationState, "localStorage"),
    ),
  };
}

function toBrowserProviderStorageCookie(
  value: unknown,
): BrowserProviderStorageCookie | undefined {
  const cookie = toRecord(value);
  const name = readString(cookie, "name");
  const cookieValue = readNullableString(cookie, "value");
  const domain = readString(cookie, "domain");
  const path = readString(cookie, "path");

  if (
    name === undefined ||
    cookieValue === undefined ||
    domain === undefined ||
    path === undefined
  ) {
    return undefined;
  }

  return {
    name,
    value: cookieValue,
    domain,
    path,
    expires: toCookieExpires(readNullableString(cookie, "expiresAt")) ?? -1,
    httpOnly: readBoolean(cookie, "httpOnly") ?? false,
    secure: readBoolean(cookie, "secure") ?? false,
    sameSite: toBrowserProviderSameSite(readString(cookie, "sameSite")) ?? "Lax",
  };
}

function toLocalStorageOrigins(
  entries: readonly unknown[],
): BrowserProviderLocalStorageOrigin[] {
  const origins = new Map<string, Array<{ name: string; value: string }>>();

  for (const entryValue of entries) {
    const entry = toRecord(entryValue);
    const origin = readHttpOrigin(readString(entry, "origin"));
    const key = readString(entry, "key");
    const value = readNullableString(entry, "value");

    if (origin === undefined || key === undefined || value === undefined) {
      continue;
    }

    const originEntries = origins.get(origin) ?? [];
    originEntries.push({
      name: key,
      value,
    });
    origins.set(origin, originEntries);
  }

  return [...origins.entries()].map(([origin, localStorage]) => ({
    origin,
    localStorage,
  }));
}

function toCookieExpires(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const expiresMs = Date.parse(value);

  if (!Number.isFinite(expiresMs)) {
    return undefined;
  }

  return Math.floor(expiresMs / 1000);
}

function toBrowserProviderSameSite(
  value: string | undefined,
): "Strict" | "Lax" | "None" | undefined {
  if (value === "STRICT") {
    return "Strict";
  }

  if (value === "LAX") {
    return "Lax";
  }

  if (value === "NONE") {
    return "None";
  }

  return undefined;
}

function toProxyScheme(protocol: string): string {
  if (protocol === "SOCKS5") {
    return "socks5";
  }

  return protocol.toLowerCase();
}

function readHttpOrigin(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

function readUnknownArray(
  value: Record<string, unknown> | undefined,
  key: string,
): readonly unknown[] {
  const rawValue = value?.[key];

  return Array.isArray(rawValue) ? rawValue : [];
}

function readString(
  value: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const rawValue = value?.[key];

  if (typeof rawValue !== "string") {
    return undefined;
  }

  const normalizedValue = rawValue.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function readNullableString(
  value: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const rawValue = value?.[key];

  if (typeof rawValue !== "string") {
    return undefined;
  }

  return rawValue;
}

function readStringArray(
  value: Record<string, unknown> | undefined,
  key: string,
): readonly string[] {
  const rawValue = value?.[key];

  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue.flatMap((item) => {
    if (typeof item !== "string") {
      return [];
    }

    const normalizedItem = item.trim();

    return normalizedItem.length > 0 ? [normalizedItem] : [];
  });
}

function readPositiveNumber(
  value: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const rawValue = value?.[key];

  return typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue > 0
    ? rawValue
    : undefined;
}

function readBoolean(
  value: Record<string, unknown> | undefined,
  key: string,
): boolean | undefined {
  const rawValue = value?.[key];

  return typeof rawValue === "boolean" ? rawValue : undefined;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  const record = toRecord(value);

  if (record === undefined) {
    throw new BrowserProviderError(
      "BROWSER_PROVIDER_CONFIGURATION_INVALID",
      `Runtime profile ${path} configuration is missing.`,
    );
  }

  return record;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
