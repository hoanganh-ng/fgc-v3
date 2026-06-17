export interface CollectionSchedulerCliOptions {
  readonly once: boolean;
  readonly pollIntervalMs: number;
}

export const DEFAULT_COLLECTION_SCHEDULER_POLL_INTERVAL_MS = 5_000;

export class CollectionSchedulerCliArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CollectionSchedulerCliArgumentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CollectionSchedulerCliHelpRequested extends Error {
  public constructor() {
    super("Collection scheduler CLI help requested.");
    this.name = "CollectionSchedulerCliHelpRequested";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseCollectionSchedulerCliArgs(
  argv: readonly string[],
): CollectionSchedulerCliOptions {
  let pollIntervalMs: string | undefined;
  let once = false;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === undefined || rawArg === "--") {
      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      throw new CollectionSchedulerCliHelpRequested();
    }

    if (rawArg === "--once") {
      if (once) {
        throw new CollectionSchedulerCliArgumentError(
          "--once can only be provided once.",
        );
      }

      once = true;
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

    if (rawArg.startsWith("-")) {
      throw new CollectionSchedulerCliArgumentError(`Unknown option ${rawArg}.`);
    }

    throw new CollectionSchedulerCliArgumentError("Unexpected positional argument.");
  }

  return {
    once,
    pollIntervalMs: normalizePositiveIntegerOption(
      pollIntervalMs,
      "--poll-interval-ms",
      DEFAULT_COLLECTION_SCHEDULER_POLL_INTERVAL_MS,
    ),
  };
}

export function getCollectionSchedulerCliUsage(): string {
  return [
    "Usage:",
    "  pnpm collector:scheduler:run -- --once",
    "  pnpm collector:scheduler:run -- [--poll-interval-ms 5000]",
    "",
    "Options:",
    "  --once               Drain all due collection schedules once, then exit.",
    "  --poll-interval-ms   Delay between polling cycles when --once is not provided. Default: 5000.",
    "  --help, -h           Print this help message and exit.",
    "",
    "Defaults:",
    "  --poll-interval-ms defaults to 5000 milliseconds when not provided.",
    "",
    "The scheduler invokes the existing DispatchNextDueCollectionScheduleUseCase on each cycle, draining every enabled due CollectionSchedule. It never executes collection runs; execution is left to the collector worker.",
  ].join("\n");
}

function readSeparatedOptionValue(
  argv: readonly string[],
  optionIndex: number,
  optionName: string,
): string {
  const value = argv[optionIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new CollectionSchedulerCliArgumentError(
      `${optionName} requires a value.`,
    );
  }

  return value;
}

function readInlineOptionValue(rawArg: string, optionName: string): string {
  const prefix = `${optionName}=`;
  const value = rawArg.slice(prefix.length);

  if (value.trim().length === 0) {
    throw new CollectionSchedulerCliArgumentError(
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
    throw new CollectionSchedulerCliArgumentError(
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
    throw new CollectionSchedulerCliArgumentError(
      `${optionName} must be a positive integer.`,
    );
  }

  return parsedValue;
}