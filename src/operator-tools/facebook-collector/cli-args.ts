import type { BrowserProviderCliValue } from "../../collector-runtime/infrastructure";
import { normalizeBrowserProviderValue } from "../../collector-runtime/infrastructure";

export interface FacebookCollectorCliArgs {
  readonly groupUrl?: string;
  readonly sourceGroupId: string;
  readonly baseUrl: string;
  readonly maxScrolls: number;
  readonly maxDurationMs: number;
  readonly browserProvider: BrowserProviderCliValue;
  readonly diagnoseCheckout: boolean;
}

export interface FacebookCollectorCliEnvironment {
  readonly BROWSER_PROVIDER?: string;
  readonly COLLECTOR_FACEBOOK_BASE_URL?: string;
  readonly PROFILE_MANAGER_BASE_URL?: string;
  readonly CONTENT_MANAGER_BASE_URL?: string;
}

export const DEFAULT_FACEBOOK_COLLECTOR_BASE_URL = "http://localhost:3000";
export const DEFAULT_FACEBOOK_COLLECTOR_MAX_SCROLLS = 3;
export const DEFAULT_FACEBOOK_COLLECTOR_MAX_DURATION_MS = 30_000;

export class FacebookCollectorCliArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "FacebookCollectorCliArgumentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FacebookCollectorCliHelpRequested extends Error {
  public constructor() {
    super("Facebook collector CLI help requested.");
    this.name = "FacebookCollectorCliHelpRequested";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseFacebookCollectorCliArgs(
  argv: readonly string[],
  environment: FacebookCollectorCliEnvironment = {},
): FacebookCollectorCliArgs {
  let groupUrl: string | undefined;
  let sourceGroupId: string | undefined;
  let baseUrl: string | undefined;
  let maxScrolls: string | undefined;
  let maxDurationMs: string | undefined;
  let browserProvider: string | undefined;
  let diagnoseCheckout = false;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === undefined || rawArg === "--") {
      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      throw new FacebookCollectorCliHelpRequested();
    }

    if (rawArg === "--group-url") {
      assertOptionNotProvided(groupUrl, "--group-url");
      groupUrl = readSeparatedOptionValue(argv, index, "--group-url");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--group-url=")) {
      assertOptionNotProvided(groupUrl, "--group-url");
      groupUrl = readInlineOptionValue(rawArg, "--group-url");
      continue;
    }

    if (rawArg === "--source-group-id") {
      assertOptionNotProvided(sourceGroupId, "--source-group-id");
      sourceGroupId = readSeparatedOptionValue(argv, index, "--source-group-id");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--source-group-id=")) {
      assertOptionNotProvided(sourceGroupId, "--source-group-id");
      sourceGroupId = readInlineOptionValue(rawArg, "--source-group-id");
      continue;
    }

    if (rawArg === "--base-url") {
      assertOptionNotProvided(baseUrl, "--base-url");
      baseUrl = readSeparatedOptionValue(argv, index, "--base-url");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--base-url=")) {
      assertOptionNotProvided(baseUrl, "--base-url");
      baseUrl = readInlineOptionValue(rawArg, "--base-url");
      continue;
    }

    if (rawArg === "--max-scrolls") {
      assertOptionNotProvided(maxScrolls, "--max-scrolls");
      maxScrolls = readSeparatedOptionValue(argv, index, "--max-scrolls");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--max-scrolls=")) {
      assertOptionNotProvided(maxScrolls, "--max-scrolls");
      maxScrolls = readInlineOptionValue(rawArg, "--max-scrolls");
      continue;
    }

    if (rawArg === "--max-duration-ms") {
      assertOptionNotProvided(maxDurationMs, "--max-duration-ms");
      maxDurationMs = readSeparatedOptionValue(
        argv,
        index,
        "--max-duration-ms",
      );
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--max-duration-ms=")) {
      assertOptionNotProvided(maxDurationMs, "--max-duration-ms");
      maxDurationMs = readInlineOptionValue(rawArg, "--max-duration-ms");
      continue;
    }

    if (rawArg === "--browser-provider") {
      assertOptionNotProvided(browserProvider, "--browser-provider");
      browserProvider = readSeparatedOptionValue(
        argv,
        index,
        "--browser-provider",
      );
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--browser-provider=")) {
      assertOptionNotProvided(browserProvider, "--browser-provider");
      browserProvider = readInlineOptionValue(rawArg, "--browser-provider");
      continue;
    }

    if (rawArg === "--diagnose-checkout") {
      if (diagnoseCheckout) {
        throw new FacebookCollectorCliArgumentError(
          "--diagnose-checkout can only be provided once.",
        );
      }

      diagnoseCheckout = true;
      continue;
    }

    if (rawArg.startsWith("-")) {
      throw new FacebookCollectorCliArgumentError(`Unknown option ${rawArg}.`);
    }

    throw new FacebookCollectorCliArgumentError(
      "Unexpected positional argument.",
    );
  }

  const normalizedGroupUrl =
    groupUrl === undefined
      ? undefined
      : normalizeFacebookGroupUrl(groupUrl, "--group-url");

  return {
    ...(normalizedGroupUrl !== undefined ? { groupUrl: normalizedGroupUrl } : {}),
    sourceGroupId: normalizeSourceGroupId(sourceGroupId),
    baseUrl: normalizeBaseUrl(
      baseUrl ??
        environment.COLLECTOR_FACEBOOK_BASE_URL ??
        environment.PROFILE_MANAGER_BASE_URL ??
        environment.CONTENT_MANAGER_BASE_URL ??
        DEFAULT_FACEBOOK_COLLECTOR_BASE_URL,
    ),
    maxScrolls: normalizeNonNegativeIntegerOption(
      maxScrolls,
      "--max-scrolls",
      DEFAULT_FACEBOOK_COLLECTOR_MAX_SCROLLS,
    ),
    maxDurationMs: normalizePositiveIntegerOption(
      maxDurationMs,
      "--max-duration-ms",
      DEFAULT_FACEBOOK_COLLECTOR_MAX_DURATION_MS,
    ),
    browserProvider: normalizeBrowserProviderOption(
      browserProvider ?? environment.BROWSER_PROVIDER,
    ),
    diagnoseCheckout,
  };
}

export function getFacebookCollectorCliUsage(): string {
  return [
    "Usage:",
    "  pnpm collector:facebook:run -- --source-group-id <source-group-id> [--base-url <url>] [--max-scrolls 3] [--max-duration-ms 30000] [--browser-provider playwright] [--diagnose-checkout]",
    "",
    "Options:",
    "  --source-group-id    Required Content Manager source group id. The command resolves the stored Facebook group URL before launch.",
    "  --group-url          Optional development override for the stored source group URL.",
    "  --base-url           API or gateway base URL for Profile Manager and Content Manager.",
    "  --max-scrolls        Maximum page scrolls before capture stops. Default: 3.",
    "  --max-duration-ms    Maximum browser capture duration in milliseconds. Default: 30000.",
    "  --browser-provider   Browser provider: playwright or cloakbrowser. Default: playwright.",
    "  --diagnose-checkout  Print safe aggregate profile status counts before checkout.",
    "",
    "Defaults:",
    "  --base-url uses COLLECTOR_FACEBOOK_BASE_URL, then PROFILE_MANAGER_BASE_URL, then CONTENT_MANAGER_BASE_URL, then http://localhost:3000.",
    "  --browser-provider uses BROWSER_PROVIDER, then playwright.",
    "",
    "The command resolves an ACTIVE Facebook source group, checks out one eligible READY profile, captures Facebook GraphQL JSON responses in memory, submits normalized candidates, releases the lease, and prints only safe counts.",
  ].join("\n");
}

function readSeparatedOptionValue(
  argv: readonly string[],
  optionIndex: number,
  optionName: string,
): string {
  const value = argv[optionIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new FacebookCollectorCliArgumentError(
      `${optionName} requires a value.`,
    );
  }

  return value;
}

function readInlineOptionValue(rawArg: string, optionName: string): string {
  const prefix = `${optionName}=`;
  const value = rawArg.slice(prefix.length);

  if (value.trim().length === 0) {
    throw new FacebookCollectorCliArgumentError(
      `${optionName} requires a value.`,
    );
  }

  return value;
}

function assertOptionNotProvided(
  existingValue: string | undefined,
  optionName: string,
): void {
  if (existingValue !== undefined) {
    throw new FacebookCollectorCliArgumentError(
      `${optionName} can only be provided once.`,
    );
  }
}

export function normalizeFacebookGroupUrl(
  value: string | undefined,
  valueName = "--group-url",
): string {
  const normalizedValue = value?.trim();

  if (normalizedValue === undefined || normalizedValue.length === 0) {
    throw new FacebookCollectorCliArgumentError(`${valueName} is required.`);
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new FacebookCollectorCliArgumentError(
      `${valueName} must be a valid Facebook group URL.`,
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new FacebookCollectorCliArgumentError(
      `${valueName} must use http or https.`,
    );
  }

  if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
    throw new FacebookCollectorCliArgumentError(
      `${valueName} must not contain embedded credentials.`,
    );
  }

  if (!isFacebookHost(parsedUrl.hostname)) {
    throw new FacebookCollectorCliArgumentError(
      `${valueName} must point to facebook.com.`,
    );
  }

  if (!parsedUrl.pathname.toLowerCase().includes("/groups/")) {
    throw new FacebookCollectorCliArgumentError(
      `${valueName} must point to a Facebook group.`,
    );
  }

  return normalizedValue;
}

function normalizeSourceGroupId(value: string | undefined): string {
  if (value === undefined) {
    throw new FacebookCollectorCliArgumentError(
      "--source-group-id is required.",
    );
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new FacebookCollectorCliArgumentError(
      "--source-group-id must be a non-empty id.",
    );
  }

  return normalizedValue;
}

function normalizeBaseUrl(value: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new FacebookCollectorCliArgumentError(
      "--base-url must be a valid http(s) URL.",
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new FacebookCollectorCliArgumentError(
      "--base-url must be a valid http(s) URL.",
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new FacebookCollectorCliArgumentError(
      "--base-url must use http or https.",
    );
  }

  if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
    throw new FacebookCollectorCliArgumentError(
      "--base-url must not contain embedded credentials.",
    );
  }

  return normalizedValue;
}

function normalizeNonNegativeIntegerOption(
  value: string | undefined,
  optionName: string,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number(value.trim());

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new FacebookCollectorCliArgumentError(
      `${optionName} must be a non-negative integer.`,
    );
  }

  return parsedValue;
}

function normalizePositiveIntegerOption(
  value: string | undefined,
  optionName: string,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number(value.trim());

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new FacebookCollectorCliArgumentError(
      `${optionName} must be a positive integer.`,
    );
  }

  return parsedValue;
}

function normalizeBrowserProviderOption(
  value: string | undefined,
): BrowserProviderCliValue {
  const result = normalizeBrowserProviderValue(value);

  if (!result.ok) {
    throw new FacebookCollectorCliArgumentError(result.message);
  }

  return result.value;
}

function isFacebookHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();

  return (
    normalizedHostname === "facebook.com" ||
    normalizedHostname === "www.facebook.com" ||
    normalizedHostname === "m.facebook.com"
  );
}
