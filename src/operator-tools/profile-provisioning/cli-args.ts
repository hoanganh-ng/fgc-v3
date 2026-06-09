export interface ProfileProvisioningCliArgs {
  readonly token: string;
  readonly baseUrl: string;
}

export interface ProfileProvisioningCliEnvironment {
  readonly PROFILE_PROVISIONING_BASE_URL?: string;
  readonly PROFILE_MANAGER_BASE_URL?: string;
}

export const DEFAULT_PROFILE_PROVISIONING_BASE_URL = "http://localhost:3000";

export class ProfileProvisioningCliArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProfileProvisioningCliArgumentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProfileProvisioningCliHelpRequested extends Error {
  public constructor() {
    super("Profile provisioning CLI help requested.");
    this.name = "ProfileProvisioningCliHelpRequested";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseProfileProvisioningCliArgs(
  argv: readonly string[],
  environment: ProfileProvisioningCliEnvironment = {},
): ProfileProvisioningCliArgs {
  let token: string | undefined;
  let baseUrl: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === undefined) {
      continue;
    }

    if (rawArg === "--") {
      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      throw new ProfileProvisioningCliHelpRequested();
    }

    if (rawArg === "--token") {
      assertOptionNotProvided(token, "--token");
      token = readSeparatedOptionValue(argv, index, "--token");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--token=")) {
      assertOptionNotProvided(token, "--token");
      token = readInlineOptionValue(rawArg, "--token");
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

    if (rawArg.startsWith("-")) {
      throw new ProfileProvisioningCliArgumentError(
        `Unknown option ${rawArg}.`,
      );
    }

    throw new ProfileProvisioningCliArgumentError(
      "Unexpected positional argument.",
    );
  }

  return {
    token: normalizeRequiredToken(token),
    baseUrl: normalizeBaseUrl(
      baseUrl ??
        environment.PROFILE_PROVISIONING_BASE_URL ??
        environment.PROFILE_MANAGER_BASE_URL ??
        DEFAULT_PROFILE_PROVISIONING_BASE_URL,
    ),
  };
}

export function getProfileProvisioningCliUsage(): string {
  return [
    "Usage:",
    "  pnpm profile:provision -- --token <provisioning-token> [--base-url <url>]",
    "",
    "Options:",
    "  --token      Required one-time provisioning token from the Web UI success state.",
    "  --base-url   Profile Manager API or gateway base URL.",
    "",
    "Defaults:",
    "  --base-url uses PROFILE_PROVISIONING_BASE_URL, then PROFILE_MANAGER_BASE_URL, then http://localhost:3000.",
    "",
    "The browser opens headed for manual login. Cookies and localStorage are submitted to Profile Manager but never printed.",
  ].join("\n");
}

function readSeparatedOptionValue(
  argv: readonly string[],
  optionIndex: number,
  optionName: string,
): string {
  const value = argv[optionIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new ProfileProvisioningCliArgumentError(
      `${optionName} requires a value.`,
    );
  }

  return value;
}

function readInlineOptionValue(rawArg: string, optionName: string): string {
  const prefix = `${optionName}=`;
  const value = rawArg.slice(prefix.length);

  if (value.trim().length === 0) {
    throw new ProfileProvisioningCliArgumentError(
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
    throw new ProfileProvisioningCliArgumentError(
      `${optionName} can only be provided once.`,
    );
  }
}

function normalizeRequiredToken(value: string | undefined): string {
  const normalizedValue = value?.trim();

  if (normalizedValue === undefined || normalizedValue.length === 0) {
    throw new ProfileProvisioningCliArgumentError("--token is required.");
  }

  return normalizedValue;
}

function normalizeBaseUrl(value: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new ProfileProvisioningCliArgumentError(
      "--base-url must be a valid http(s) URL.",
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new ProfileProvisioningCliArgumentError(
      "--base-url must be a valid http(s) URL.",
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new ProfileProvisioningCliArgumentError(
      "--base-url must use http or https.",
    );
  }

  if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
    throw new ProfileProvisioningCliArgumentError(
      "--base-url must not contain embedded credentials.",
    );
  }

  return normalizedValue;
}
