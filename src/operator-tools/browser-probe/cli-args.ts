import type { BrowserProviderCliValue } from "../../collector-runtime/infrastructure";
import { normalizeBrowserProviderValue } from "../../collector-runtime/infrastructure";

export interface BrowserProbeCliArgs {
  readonly browserProvider: BrowserProviderCliValue;
  readonly timeoutMs: number;
}

export interface BrowserProbeCliEnvironment {
  readonly BROWSER_PROVIDER?: string;
}

export const DEFAULT_BROWSER_PROBE_TIMEOUT_MS = 15_000;

export class BrowserProbeCliArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BrowserProbeCliArgumentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BrowserProbeCliHelpRequested extends Error {
  public constructor() {
    super("Browser probe CLI help requested.");
    this.name = "BrowserProbeCliHelpRequested";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseBrowserProbeCliArgs(
  argv: readonly string[],
  environment: BrowserProbeCliEnvironment = {},
): BrowserProbeCliArgs {
  let browserProvider: string | undefined;
  let timeoutMs: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === undefined || rawArg === "--") {
      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      throw new BrowserProbeCliHelpRequested();
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
      throw new BrowserProbeCliArgumentError(`Unknown option ${rawArg}.`);
    }

    throw new BrowserProbeCliArgumentError("Unexpected positional argument.");
  }

  return {
    browserProvider: normalizeBrowserProviderOption(
      browserProvider ?? environment.BROWSER_PROVIDER,
    ),
    timeoutMs: normalizePositiveIntegerOption(
      timeoutMs,
      "--timeout-ms",
      DEFAULT_BROWSER_PROBE_TIMEOUT_MS,
    ),
  };
}

export function getBrowserProbeCliUsage(): string {
  return [
    "Usage:",
    "  pnpm collector:browser:probe -- --browser-provider playwright",
    "  pnpm collector:browser:probe -- --browser-provider cloakbrowser",
    "",
    "Options:",
    "  --browser-provider   Browser provider: playwright or cloakbrowser. Default: playwright.",
    "  --timeout-ms         Launch and page probe timeout in milliseconds. Default: 15000.",
    "",
    "Defaults:",
    "  --browser-provider uses BROWSER_PROVIDER, then playwright.",
    "",
    "The probe launches a browser provider with a synthetic safe runtime profile configuration, creates one page, and verifies init-script plus binding instrumentation without visiting Facebook.",
  ].join("\n");
}

function readSeparatedOptionValue(
  argv: readonly string[],
  optionIndex: number,
  optionName: string,
): string {
  const value = argv[optionIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new BrowserProbeCliArgumentError(`${optionName} requires a value.`);
  }

  return value;
}

function readInlineOptionValue(rawArg: string, optionName: string): string {
  const prefix = `${optionName}=`;
  const value = rawArg.slice(prefix.length);

  if (value.trim().length === 0) {
    throw new BrowserProbeCliArgumentError(`${optionName} requires a value.`);
  }

  return value;
}

function assertOptionNotProvided(
  existingValue: string | undefined,
  optionName: string,
): void {
  if (existingValue !== undefined) {
    throw new BrowserProbeCliArgumentError(
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
    throw new BrowserProbeCliArgumentError(
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
    throw new BrowserProbeCliArgumentError(result.message);
  }

  return result.value;
}
