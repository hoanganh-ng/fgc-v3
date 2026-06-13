import type { BrowserProviderCliValue } from "../../collector-runtime/infrastructure";
import { normalizeBrowserProviderValue } from "../../collector-runtime/infrastructure";

export interface AssistedGroupAccessCliArgs {
  readonly profileId: string;
  readonly sourceGroupId: string;
  readonly baseUrl: string;
  readonly entryRouteId?: string;
  readonly browserProvider: BrowserProviderCliValue;
  readonly maxDurationMs: number;
  readonly allowHighRiskRoute: boolean;
}

export interface AssistedGroupAccessCliEnvironment {
  readonly BROWSER_PROVIDER?: string;
}

export const DEFAULT_ASSISTED_GROUP_ACCESS_MAX_DURATION_MS = 600_000;
export const MIN_ASSISTED_GROUP_ACCESS_MAX_DURATION_MS = 30_000;
export const MAX_ASSISTED_GROUP_ACCESS_MAX_DURATION_MS = 1_800_000;

export class AssistedGroupAccessCliArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AssistedGroupAccessCliArgumentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AssistedGroupAccessCliHelpRequested extends Error {
  public constructor() {
    super("Assisted group access CLI help requested.");
    this.name = "AssistedGroupAccessCliHelpRequested";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseAssistedGroupAccessCliArgs(
  argv: readonly string[],
  environment: AssistedGroupAccessCliEnvironment = {},
): AssistedGroupAccessCliArgs {
  let profileId: string | undefined;
  let sourceGroupId: string | undefined;
  let baseUrl: string | undefined;
  let entryRouteId: string | undefined;
  let browserProvider: string | undefined;
  let maxDurationMs: string | undefined;
  let allowHighRiskRoute = false;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === undefined || rawArg === "--") {
      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      throw new AssistedGroupAccessCliHelpRequested();
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

    if (rawArg === "--entry-route-id") {
      assertOptionNotProvided(entryRouteId, "--entry-route-id");
      entryRouteId = readSeparatedOptionValue(argv, index, "--entry-route-id");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--entry-route-id=")) {
      assertOptionNotProvided(entryRouteId, "--entry-route-id");
      entryRouteId = readInlineOptionValue(rawArg, "--entry-route-id");
      continue;
    }

    if (rawArg === "--browser-provider") {
      assertOptionNotProvided(browserProvider, "--browser-provider");
      browserProvider = readSeparatedOptionValue(argv, index, "--browser-provider");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--browser-provider=")) {
      assertOptionNotProvided(browserProvider, "--browser-provider");
      browserProvider = readInlineOptionValue(rawArg, "--browser-provider");
      continue;
    }

    if (rawArg === "--max-duration-ms") {
      assertOptionNotProvided(maxDurationMs, "--max-duration-ms");
      maxDurationMs = readSeparatedOptionValue(argv, index, "--max-duration-ms");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--max-duration-ms=")) {
      assertOptionNotProvided(maxDurationMs, "--max-duration-ms");
      maxDurationMs = readInlineOptionValue(rawArg, "--max-duration-ms");
      continue;
    }

    if (rawArg === "--allow-high-risk-route") {
      if (allowHighRiskRoute) {
        throw new AssistedGroupAccessCliArgumentError(
          "--allow-high-risk-route can only be provided once.",
        );
      }

      allowHighRiskRoute = true;
      continue;
    }

    if (rawArg.startsWith("-")) {
      throw new AssistedGroupAccessCliArgumentError(`Unknown option ${rawArg}.`);
    }

    throw new AssistedGroupAccessCliArgumentError(
      "Unexpected positional argument.",
    );
  }

  return {
    profileId: normalizeRequiredId(profileId, "--profile-id"),
    sourceGroupId: normalizeRequiredId(sourceGroupId, "--source-group-id"),
    baseUrl: normalizeRequiredBaseUrl(baseUrl),
    ...(entryRouteId !== undefined
      ? { entryRouteId: normalizeRequiredId(entryRouteId, "--entry-route-id") }
      : {}),
    browserProvider: normalizeBrowserProviderOption(
      browserProvider ?? environment.BROWSER_PROVIDER,
    ),
    maxDurationMs: normalizeMaxDurationMs(maxDurationMs),
    allowHighRiskRoute,
  };
}

export function getAssistedGroupAccessCliUsage(): string {
  return [
    "Usage:",
    "  pnpm operator:profile:assisted-access -- --profile-id <profile-id> --source-group-id <source-group-id> --base-url <url> [--entry-route-id <route-id>] [--browser-provider playwright] [--max-duration-ms 600000] [--allow-high-risk-route]",
    "",
    "Options:",
    "  --profile-id              Required Collector Profile Manager profile id.",
    "  --source-group-id         Required Content Manager source group id.",
    "  --base-url                Required API or gateway base URL for Collector HTTP routes.",
    "  --entry-route-id          Optional explicit source group entry route id.",
    "  --browser-provider        Browser provider: playwright or cloakbrowser. Default: playwright.",
    "  --max-duration-ms         Maximum operator session duration in milliseconds. Default: 600000. Range: 30000-1800000.",
    "  --allow-high-risk-route   Allow a selected HIGH-risk entry route.",
    "",
    "Defaults:",
    "  --browser-provider uses BROWSER_PROVIDER, then playwright.",
    "",
    "The command checks out the profile for ASSISTED_GROUP_ACCESS, opens only the selected safe entry-route URL in a headed browser for manual inspection, waits for Enter or timeout, then closes the browser and releases the lease.",
  ].join("\n");
}

function readSeparatedOptionValue(
  argv: readonly string[],
  optionIndex: number,
  optionName: string,
): string {
  const value = argv[optionIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new AssistedGroupAccessCliArgumentError(
      `${optionName} requires a value.`,
    );
  }

  return value;
}

function readInlineOptionValue(rawArg: string, optionName: string): string {
  const prefix = `${optionName}=`;
  const value = rawArg.slice(prefix.length);

  if (value.trim().length === 0) {
    throw new AssistedGroupAccessCliArgumentError(
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
    throw new AssistedGroupAccessCliArgumentError(
      `${optionName} can only be provided once.`,
    );
  }
}

function normalizeRequiredId(value: string | undefined, optionName: string): string {
  if (value === undefined) {
    throw new AssistedGroupAccessCliArgumentError(`${optionName} is required.`);
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new AssistedGroupAccessCliArgumentError(
      `${optionName} must be a non-empty id.`,
    );
  }

  return normalizedValue;
}

function normalizeRequiredBaseUrl(value: string | undefined): string {
  if (value === undefined) {
    throw new AssistedGroupAccessCliArgumentError("--base-url is required.");
  }

  const normalizedValue = value.trim();

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new AssistedGroupAccessCliArgumentError(
      "--base-url must be a valid http(s) URL.",
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new AssistedGroupAccessCliArgumentError(
      "--base-url must use http or https.",
    );
  }

  if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
    throw new AssistedGroupAccessCliArgumentError(
      "--base-url must not contain embedded credentials.",
    );
  }

  return normalizedValue;
}

function normalizeMaxDurationMs(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_ASSISTED_GROUP_ACCESS_MAX_DURATION_MS;
  }

  const parsedValue = Number(value.trim());

  if (!Number.isInteger(parsedValue)) {
    throw new AssistedGroupAccessCliArgumentError(
      "--max-duration-ms must be an integer.",
    );
  }

  if (
    parsedValue < MIN_ASSISTED_GROUP_ACCESS_MAX_DURATION_MS ||
    parsedValue > MAX_ASSISTED_GROUP_ACCESS_MAX_DURATION_MS
  ) {
    throw new AssistedGroupAccessCliArgumentError(
      "--max-duration-ms must be between 30000 and 1800000.",
    );
  }

  return parsedValue;
}

function normalizeBrowserProviderOption(
  value: string | undefined,
): BrowserProviderCliValue {
  const result = normalizeBrowserProviderValue(value);

  if (!result.ok) {
    throw new AssistedGroupAccessCliArgumentError(result.message);
  }

  return result.value;
}
