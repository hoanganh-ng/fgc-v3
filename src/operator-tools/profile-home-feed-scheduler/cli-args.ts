export interface ProfileHomeFeedSchedulerCliOptions {
  readonly once: boolean;
  readonly pollIntervalMs: number;
}

export const DEFAULT_PROFILE_HOME_FEED_SCHEDULER_POLL_INTERVAL_MS = 5_000;

export class ProfileHomeFeedSchedulerCliArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProfileHomeFeedSchedulerCliArgumentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProfileHomeFeedSchedulerCliHelpRequested extends Error {
  public constructor() {
    super("Profile home-feed scheduler CLI help requested.");
    this.name = "ProfileHomeFeedSchedulerCliHelpRequested";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseProfileHomeFeedSchedulerCliArgs(
  argv: readonly string[],
): ProfileHomeFeedSchedulerCliOptions {
  let pollIntervalMs: string | undefined;
  let once = false;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === undefined || rawArg === "--") {
      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      throw new ProfileHomeFeedSchedulerCliHelpRequested();
    }

    if (rawArg === "--once") {
      if (once) {
        throw new ProfileHomeFeedSchedulerCliArgumentError(
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
      throw new ProfileHomeFeedSchedulerCliArgumentError(
        `Unknown option ${rawArg}.`,
      );
    }

    throw new ProfileHomeFeedSchedulerCliArgumentError(
      "Unexpected positional argument.",
    );
  }

  return {
    once,
    pollIntervalMs: normalizePositiveIntegerOption(
      pollIntervalMs,
      "--poll-interval-ms",
      DEFAULT_PROFILE_HOME_FEED_SCHEDULER_POLL_INTERVAL_MS,
    ),
  };
}

export function getProfileHomeFeedSchedulerCliUsage(): string {
  return [
    "Usage:",
    "  pnpm profile-home-feed:scheduler:run -- --once",
    "  pnpm profile-home-feed:scheduler:run -- [--poll-interval-ms 5000]",
    "",
    "Options:",
    "  --once               Drain all due profile home-feed schedules once, then exit.",
    "  --poll-interval-ms   Delay between polling cycles when --once is not provided. Default: 5000.",
    "  --help, -h           Print this help message and exit.",
    "",
    "Defaults:",
    "  --poll-interval-ms defaults to 5000 milliseconds when not provided.",
    "",
    "Environment:",
    "  DATABASE_URL is required for production composition; the scheduler",
    "  resolves it through the existing Collector Runtime composition root.",
    "  Other module base URLs follow the Collector Runtime configuration.",
    "",
    "The scheduler invokes the existing",
    "DispatchNextDueProfileHomeFeedCollectionScheduleUseCase on each cycle,",
    "draining every enabled due ProfileHomeFeedCollectionSchedule into either",
    "a queued ProfileHomeFeedCollectionRun or a safe skip/defer outcome. It",
    "never executes collection runs; execution is left to the home-feed runner.",
  ].join("\n");
}

function readSeparatedOptionValue(
  argv: readonly string[],
  optionIndex: number,
  optionName: string,
): string {
  const value = argv[optionIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new ProfileHomeFeedSchedulerCliArgumentError(
      `${optionName} requires a value.`,
    );
  }

  return value;
}

function readInlineOptionValue(rawArg: string, optionName: string): string {
  const prefix = `${optionName}=`;
  const value = rawArg.slice(prefix.length);

  if (value.trim().length === 0) {
    throw new ProfileHomeFeedSchedulerCliArgumentError(
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
    throw new ProfileHomeFeedSchedulerCliArgumentError(
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
    throw new ProfileHomeFeedSchedulerCliArgumentError(
      `${optionName} must be a positive integer.`,
    );
  }

  return parsedValue;
}
