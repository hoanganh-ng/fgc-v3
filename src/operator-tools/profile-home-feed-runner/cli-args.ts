import type { BrowserProviderCliValue } from "../../collector-runtime/infrastructure";
import { normalizeBrowserProviderValue } from "../../collector-runtime/infrastructure";

export interface ProfileHomeFeedRunNextCliArgs {
  readonly baseUrl: string;
  readonly browserProvider: BrowserProviderCliValue;
}

export interface ProfileHomeFeedRunNextCliEnvironment {
  readonly BROWSER_PROVIDER?: string;
  readonly PROFILE_HOME_FEED_RUNNER_BASE_URL?: string;
  readonly PROFILE_MANAGER_BASE_URL?: string;
  readonly CONTENT_MANAGER_BASE_URL?: string;
}

export const DEFAULT_PROFILE_HOME_FEED_RUNNER_BASE_URL =
  "http://localhost:3000";

export class ProfileHomeFeedRunNextCliArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProfileHomeFeedRunNextCliArgumentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProfileHomeFeedRunNextCliHelpRequested extends Error {
  public constructor() {
    super("Profile home-feed run-next CLI help requested.");
    this.name = "ProfileHomeFeedRunNextCliHelpRequested";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseProfileHomeFeedRunNextCliArgs(
  argv: readonly string[],
  environment: ProfileHomeFeedRunNextCliEnvironment = {},
): ProfileHomeFeedRunNextCliArgs {
  let baseUrl: string | undefined;
  let browserProvider: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === undefined || rawArg === "--") {
      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      throw new ProfileHomeFeedRunNextCliHelpRequested();
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
      throw new ProfileHomeFeedRunNextCliArgumentError(
        `Unknown option ${rawArg}.`,
      );
    }

    throw new ProfileHomeFeedRunNextCliArgumentError(
      "Unexpected positional argument.",
    );
  }

  return {
    baseUrl: normalizeBaseUrl(
      baseUrl ??
        environment.PROFILE_HOME_FEED_RUNNER_BASE_URL ??
        environment.PROFILE_MANAGER_BASE_URL ??
        environment.CONTENT_MANAGER_BASE_URL ??
        DEFAULT_PROFILE_HOME_FEED_RUNNER_BASE_URL,
    ),
    browserProvider: normalizeBrowserProviderOption(
      browserProvider ?? environment.BROWSER_PROVIDER,
    ),
  };
}

export function getProfileHomeFeedRunNextCliUsage(): string {
  return [
    "Usage:",
    "  pnpm profile:home-feed:run-next -- --base-url <url> [--browser-provider playwright]",
    "",
    "Options:",
    "  --base-url           API or gateway base URL for Profile Manager and Content Manager HTTP routes.",
    "  --browser-provider   Browser provider: playwright or cloakbrowser. Default: playwright.",
    "",
    "Defaults:",
    "  --base-url uses PROFILE_HOME_FEED_RUNNER_BASE_URL, then PROFILE_MANAGER_BASE_URL, then CONTENT_MANAGER_BASE_URL, then http://localhost:3000.",
    "  --browser-provider uses BROWSER_PROVIDER, then playwright.",
    "",
    "Claims at most one queued profile home-feed collection run, executes it under bounded scroll/duration/post limits, releases the lease, and exits.",
  ].join("\n");
}

function readSeparatedOptionValue(
  argv: readonly string[],
  optionIndex: number,
  optionName: string,
): string {
  const value = argv[optionIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new ProfileHomeFeedRunNextCliArgumentError(
      `${optionName} requires a value.`,
    );
  }

  return value;
}

function readInlineOptionValue(rawArg: string, optionName: string): string {
  const prefix = `${optionName}=`;
  const value = rawArg.slice(prefix.length);

  if (value.trim().length === 0) {
    throw new ProfileHomeFeedRunNextCliArgumentError(
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
    throw new ProfileHomeFeedRunNextCliArgumentError(
      `${optionName} can only be provided once.`,
    );
  }
}

function normalizeBaseUrl(value: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new ProfileHomeFeedRunNextCliArgumentError(
      "--base-url must be a valid http(s) URL.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new ProfileHomeFeedRunNextCliArgumentError(
      "--base-url must be a valid http(s) URL.",
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new ProfileHomeFeedRunNextCliArgumentError(
      "--base-url must use http or https.",
    );
  }

  if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
    throw new ProfileHomeFeedRunNextCliArgumentError(
      "--base-url must not contain embedded credentials.",
    );
  }

  return normalizedValue;
}

function normalizeBrowserProviderOption(
  value: string | undefined,
): BrowserProviderCliValue {
  const result = normalizeBrowserProviderValue(value);

  if (!result.ok) {
    throw new ProfileHomeFeedRunNextCliArgumentError(result.message);
  }

  return result.value;
}
