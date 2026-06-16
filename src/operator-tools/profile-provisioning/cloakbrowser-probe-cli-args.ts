export interface CloakBrowserProvisioningProbeCliArgs {
  readonly launchHeaded: boolean;
  readonly timeoutMs: number;
}

export const DEFAULT_CLOAK_BROWSER_PROVISIONING_PROBE_TIMEOUT_MS = 15_000;

export class CloakBrowserProvisioningProbeCliArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CloakBrowserProvisioningProbeCliArgumentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CloakBrowserProvisioningProbeCliHelpRequested extends Error {
  public constructor() {
    super("CloakBrowser provisioning probe CLI help requested.");
    this.name = "CloakBrowserProvisioningProbeCliHelpRequested";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseCloakBrowserProvisioningProbeCliArgs(
  argv: readonly string[],
): CloakBrowserProvisioningProbeCliArgs {
  let launchHeaded = false;
  let timeoutMs: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === undefined || rawArg === "--") {
      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      throw new CloakBrowserProvisioningProbeCliHelpRequested();
    }

    if (rawArg === "--launch-headed") {
      launchHeaded = true;
      continue;
    }

    if (rawArg === "--timeout-ms") {
      assertOptionNotProvided(timeoutMs, "--timeout-ms");
      timeoutMs = readSeparatedOptionValue(argv, index, "--timeout-ms");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--timeout-ms=")) {
      assertOptionNotProvided(timeoutMs, "--timeout-ms");
      timeoutMs = readInlineOptionValue(rawArg, "--timeout-ms");
      continue;
    }

    if (rawArg.startsWith("-")) {
      throw new CloakBrowserProvisioningProbeCliArgumentError(
        `Unknown option ${rawArg}.`,
      );
    }

    throw new CloakBrowserProvisioningProbeCliArgumentError(
      "Unexpected positional argument.",
    );
  }

  return {
    launchHeaded,
    timeoutMs: normalizePositiveIntegerOption(
      timeoutMs,
      "--timeout-ms",
      DEFAULT_CLOAK_BROWSER_PROVISIONING_PROBE_TIMEOUT_MS,
    ),
  };
}

export function getCloakBrowserProvisioningProbeCliUsage(): string {
  return [
    "Usage:",
    "  pnpm operator:profile:provision:cloakbrowser-probe --",
    "  pnpm operator:profile:provision:cloakbrowser-probe -- --launch-headed",
    "",
    "Options:",
    "  --launch-headed   Launch a headed synthetic CloakBrowser page and close it. No Facebook login or session submission.",
    "  --timeout-ms       Launch and page probe timeout in milliseconds. Default: 15000.",
    "",
    "The default probe checks package/API/binary availability and prints sanitized reason codes only.",
  ].join("\n");
}

function readSeparatedOptionValue(
  argv: readonly string[],
  optionIndex: number,
  optionName: string,
): string {
  const value = argv[optionIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new CloakBrowserProvisioningProbeCliArgumentError(
      `${optionName} requires a value.`,
    );
  }

  return value;
}

function readInlineOptionValue(rawArg: string, optionName: string): string {
  const prefix = `${optionName}=`;
  const value = rawArg.slice(prefix.length);

  if (value.trim().length === 0) {
    throw new CloakBrowserProvisioningProbeCliArgumentError(
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
    throw new CloakBrowserProvisioningProbeCliArgumentError(
      `${optionName} can only be provided once.`,
    );
  }
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
    throw new CloakBrowserProvisioningProbeCliArgumentError(
      `${optionName} must be a positive integer.`,
    );
  }

  return parsedValue;
}
