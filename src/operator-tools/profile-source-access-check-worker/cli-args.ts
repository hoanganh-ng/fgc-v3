import type { BrowserProviderCliValue } from "../../collector-runtime/infrastructure";
import { normalizeBrowserProviderValue } from "../../collector-runtime/infrastructure";

export interface ProfileSourceAccessCheckWorkerCliArgs {
  readonly baseUrl: string;
  readonly once: boolean;
  readonly pollIntervalMs: number;
  readonly browserProvider: BrowserProviderCliValue;
}

export interface ProfileSourceAccessCheckWorkerCliEnvironment {
  readonly BROWSER_PROVIDER?: string;
  readonly PROFILE_SOURCE_ACCESS_CHECK_WORKER_BASE_URL?: string;
  readonly PROFILE_MANAGER_BASE_URL?: string;
}

export const DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_WORKER_BASE_URL =
  "http://localhost:3000";
export const DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_WORKER_POLL_INTERVAL_MS = 5_000;

export class ProfileSourceAccessCheckWorkerCliArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProfileSourceAccessCheckWorkerCliArgumentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProfileSourceAccessCheckWorkerCliHelpRequested extends Error {
  public constructor() {
    super("Profile-source access check worker CLI help requested.");
    this.name = "ProfileSourceAccessCheckWorkerCliHelpRequested";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseProfileSourceAccessCheckWorkerCliArgs(
  argv: readonly string[],
  environment: ProfileSourceAccessCheckWorkerCliEnvironment = {},
): ProfileSourceAccessCheckWorkerCliArgs {
  let baseUrl: string | undefined;
  let pollIntervalMs: string | undefined;
  let browserProvider: string | undefined;
  let once = false;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === undefined || rawArg === "--") {
      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      throw new ProfileSourceAccessCheckWorkerCliHelpRequested();
    }

    if (rawArg === "--once") {
      if (once) {
        throw new ProfileSourceAccessCheckWorkerCliArgumentError(
          "--once can only be provided once.",
        );
      }
      once = true;
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

    if (rawArg === "--poll-interval-ms") {
      assertOptionNotProvided(pollIntervalMs, "--poll-interval-ms");
      pollIntervalMs = readSeparatedOptionValue(
        argv,
        index,
        "--poll-interval-ms",
      );
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--poll-interval-ms=")) {
      assertOptionNotProvided(pollIntervalMs, "--poll-interval-ms");
      pollIntervalMs = readInlineOptionValue(rawArg, "--poll-interval-ms");
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

    if (rawArg.startsWith("-")) {
      throw new ProfileSourceAccessCheckWorkerCliArgumentError(
        `Unknown option ${rawArg}.`,
      );
    }

    throw new ProfileSourceAccessCheckWorkerCliArgumentError(
      "Unexpected positional argument.",
    );
  }

  return {
    baseUrl: normalizeBaseUrl(
      baseUrl ??
        environment.PROFILE_SOURCE_ACCESS_CHECK_WORKER_BASE_URL ??
        environment.PROFILE_MANAGER_BASE_URL ??
        DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_WORKER_BASE_URL,
    ),
    once,
    pollIntervalMs: normalizePositiveIntegerOption(
      pollIntervalMs,
      "--poll-interval-ms",
      DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_WORKER_POLL_INTERVAL_MS,
    ),
    browserProvider: normalizeBrowserProviderOption(
      browserProvider ?? environment.BROWSER_PROVIDER,
    ),
  };
}

export function getProfileSourceAccessCheckWorkerCliUsage(): string {
  return [
    "Usage:",
    "  pnpm operator:profile-source-access-check-worker -- --base-url <url> --once",
    "  pnpm operator:profile-source-access-check-worker -- --base-url <url> [--poll-interval-ms 5000]",
    "",
    "Options:",
    "  --base-url           API or gateway base URL for Profile Manager HTTP routes.",
    "  --once               Claim and execute at most one queued profile-source access check run, then exit.",
    "  --poll-interval-ms   Delay between polling attempts when --once is not provided. Default: 5000.",
    "  --browser-provider   Browser provider: playwright or cloakbrowser. Default: playwright.",
    "",
    "Defaults:",
    "  --base-url uses PROFILE_SOURCE_ACCESS_CHECK_WORKER_BASE_URL, then PROFILE_MANAGER_BASE_URL, then http://localhost:3000.",
    "  --browser-provider uses BROWSER_PROVIDER, then playwright.",
    "",
    "The worker claims queued profile-source access check runs from PostgreSQL, opens only the frozen DIRECT_GROUP_URL target, and stores only safe outcomes or sanitized failures.",
  ].join("\n");
}

function readSeparatedOptionValue(
  argv: readonly string[],
  optionIndex: number,
  optionName: string,
): string {
  const value = argv[optionIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new ProfileSourceAccessCheckWorkerCliArgumentError(
      `${optionName} requires a value.`,
    );
  }

  return value;
}

function readInlineOptionValue(rawArg: string, optionName: string): string {
  const prefix = `${optionName}=`;
  const value = rawArg.slice(prefix.length);

  if (value.trim().length === 0) {
    throw new ProfileSourceAccessCheckWorkerCliArgumentError(
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
    throw new ProfileSourceAccessCheckWorkerCliArgumentError(
      `${optionName} can only be provided once.`,
    );
  }
}

function normalizeBaseUrl(value: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new ProfileSourceAccessCheckWorkerCliArgumentError(
      "--base-url must be a valid http(s) URL.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new ProfileSourceAccessCheckWorkerCliArgumentError(
      "--base-url must be a valid http(s) URL.",
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new ProfileSourceAccessCheckWorkerCliArgumentError(
      "--base-url must use http or https.",
    );
  }

  if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
    throw new ProfileSourceAccessCheckWorkerCliArgumentError(
      "--base-url must not contain embedded credentials.",
    );
  }

  return normalizedValue;
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
    throw new ProfileSourceAccessCheckWorkerCliArgumentError(
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
    throw new ProfileSourceAccessCheckWorkerCliArgumentError(result.message);
  }

  return result.value;
}
