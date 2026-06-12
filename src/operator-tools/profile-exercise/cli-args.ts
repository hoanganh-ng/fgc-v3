import type { BrowserProviderCliValue } from "../../collector-runtime/infrastructure";
import { normalizeBrowserProviderValue } from "../../collector-runtime/infrastructure";

export interface ProfileExerciseCliArgs {
  readonly profileId: string;
  readonly baseUrl: string;
  readonly maxDurationMs: number;
  readonly maxScrolls: number;
  readonly minDwellMs: number;
  readonly browserProvider: BrowserProviderCliValue;
}

export interface ProfileExerciseCliEnvironment {
  readonly BROWSER_PROVIDER?: string;
  readonly PROFILE_EXERCISE_BASE_URL?: string;
  readonly PROFILE_MANAGER_BASE_URL?: string;
  readonly COLLECTOR_FACEBOOK_BASE_URL?: string;
}

export const DEFAULT_PROFILE_EXERCISE_BASE_URL = "http://localhost:3000";
export const DEFAULT_PROFILE_EXERCISE_MAX_DURATION_MS = 120_000;
export const DEFAULT_PROFILE_EXERCISE_MAX_SCROLLS = 2;
export const DEFAULT_PROFILE_EXERCISE_MIN_DWELL_MS = 2_000;

export class ProfileExerciseCliArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProfileExerciseCliArgumentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProfileExerciseCliHelpRequested extends Error {
  public constructor() {
    super("Profile exercise CLI help requested.");
    this.name = "ProfileExerciseCliHelpRequested";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseProfileExerciseCliArgs(
  argv: readonly string[],
  environment: ProfileExerciseCliEnvironment = {},
): ProfileExerciseCliArgs {
  let profileId: string | undefined;
  let baseUrl: string | undefined;
  let maxDurationMs: string | undefined;
  let maxScrolls: string | undefined;
  let minDwellMs: string | undefined;
  let browserProvider: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === undefined || rawArg === "--") {
      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      throw new ProfileExerciseCliHelpRequested();
    }

    if (rawArg === "--profile-id") {
      assertOptionNotProvided(profileId, "--profile-id");
      profileId = readSeparatedOptionValue(argv, index, "--profile-id");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--profile-id=")) {
      assertOptionNotProvided(profileId, "--profile-id");
      profileId = readInlineOptionValue(rawArg, "--profile-id");
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

    if (rawArg === "--min-dwell-ms") {
      assertOptionNotProvided(minDwellMs, "--min-dwell-ms");
      minDwellMs = readSeparatedOptionValue(argv, index, "--min-dwell-ms");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--min-dwell-ms=")) {
      assertOptionNotProvided(minDwellMs, "--min-dwell-ms");
      minDwellMs = readInlineOptionValue(rawArg, "--min-dwell-ms");
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
      throw new ProfileExerciseCliArgumentError(`Unknown option ${rawArg}.`);
    }

    throw new ProfileExerciseCliArgumentError("Unexpected positional argument.");
  }

  return {
    profileId: normalizeProfileId(profileId),
    baseUrl: normalizeBaseUrl(
      baseUrl ??
        environment.PROFILE_EXERCISE_BASE_URL ??
        environment.PROFILE_MANAGER_BASE_URL ??
        environment.COLLECTOR_FACEBOOK_BASE_URL ??
        DEFAULT_PROFILE_EXERCISE_BASE_URL,
    ),
    maxDurationMs: normalizePositiveIntegerOption(
      maxDurationMs,
      "--max-duration-ms",
      DEFAULT_PROFILE_EXERCISE_MAX_DURATION_MS,
    ),
    maxScrolls: normalizeNonNegativeIntegerOption(
      maxScrolls,
      "--max-scrolls",
      DEFAULT_PROFILE_EXERCISE_MAX_SCROLLS,
    ),
    minDwellMs: normalizeNonNegativeIntegerOption(
      minDwellMs,
      "--min-dwell-ms",
      DEFAULT_PROFILE_EXERCISE_MIN_DWELL_MS,
    ),
    browserProvider: normalizeBrowserProviderOption(
      browserProvider ?? environment.BROWSER_PROVIDER,
    ),
  };
}

export function getProfileExerciseCliUsage(): string {
  return [
    "Usage:",
    "  pnpm operator:profile:exercise -- --profile-id <profile-id> [--base-url <url>] [--max-duration-ms 120000] [--max-scrolls 2] [--min-dwell-ms 2000] [--browser-provider playwright]",
    "",
    "Options:",
    "  --profile-id         Required Collector Profile Manager profile id.",
    "  --base-url           API or gateway base URL for Collector HTTP routes.",
    "  --max-duration-ms    Maximum browser exercise duration in milliseconds. Default: 120000.",
    "  --max-scrolls        Maximum light page scrolls. Default: 2.",
    "  --min-dwell-ms       Minimum dwell between read-only actions. Default: 2000.",
    "  --browser-provider   Browser provider: playwright or cloakbrowser. Default: playwright.",
    "",
    "Defaults:",
    "  --base-url uses PROFILE_EXERCISE_BASE_URL, then PROFILE_MANAGER_BASE_URL, then COLLECTOR_FACEBOOK_BASE_URL, then http://localhost:3000.",
    "  --browser-provider uses BROWSER_PROVIDER, then playwright.",
    "",
    "The command records an ambient account exercise run, checks out the profile for AMBIENT_EXERCISE, opens Facebook in a headed browser, performs only read-only dwell and light scrolls, releases the lease, and stores only safe summary or sanitized failure data.",
  ].join("\n");
}

function readSeparatedOptionValue(
  argv: readonly string[],
  optionIndex: number,
  optionName: string,
): string {
  const value = argv[optionIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new ProfileExerciseCliArgumentError(`${optionName} requires a value.`);
  }

  return value;
}

function readInlineOptionValue(rawArg: string, optionName: string): string {
  const prefix = `${optionName}=`;
  const value = rawArg.slice(prefix.length);

  if (value.trim().length === 0) {
    throw new ProfileExerciseCliArgumentError(`${optionName} requires a value.`);
  }

  return value;
}

function assertOptionNotProvided(
  existingValue: string | undefined,
  optionName: string,
): void {
  if (existingValue !== undefined) {
    throw new ProfileExerciseCliArgumentError(
      `${optionName} can only be provided once.`,
    );
  }
}

function normalizeProfileId(value: string | undefined): string {
  if (value === undefined) {
    throw new ProfileExerciseCliArgumentError("--profile-id is required.");
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new ProfileExerciseCliArgumentError(
      "--profile-id must be a non-empty id.",
    );
  }

  return normalizedValue;
}

function normalizeBaseUrl(value: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new ProfileExerciseCliArgumentError(
      "--base-url must be a valid http(s) URL.",
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new ProfileExerciseCliArgumentError(
      "--base-url must be a valid http(s) URL.",
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new ProfileExerciseCliArgumentError(
      "--base-url must use http or https.",
    );
  }

  if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
    throw new ProfileExerciseCliArgumentError(
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
    throw new ProfileExerciseCliArgumentError(
      `${optionName} must be a positive integer.`,
    );
  }

  return parsedValue;
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
    throw new ProfileExerciseCliArgumentError(
      `${optionName} must be a non-negative integer.`,
    );
  }

  return parsedValue;
}

function normalizeBrowserProviderOption(
  value: string | undefined,
): BrowserProviderCliValue {
  const result = normalizeBrowserProviderValue(value);

  if (!result.ok) {
    throw new ProfileExerciseCliArgumentError(result.message);
  }

  return result.value;
}
