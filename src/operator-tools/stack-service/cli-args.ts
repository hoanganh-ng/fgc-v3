export const STACK_SERVICE_STACKS = ["dev", "preview"] as const;
export const STACK_SERVICE_SERVICES = [
  "collector-worker",
  "account-exercise-worker",
  "collection-scheduler",
  "profile-home-feed-scheduler",
  "profile-home-feed-worker",
  "all",
] as const;
export const STACK_SERVICE_ACTIONS = ["start", "once", "logs"] as const;

export type StackServiceStack = (typeof STACK_SERVICE_STACKS)[number];
export type StackServiceService = (typeof STACK_SERVICE_SERVICES)[number];
export type StackServiceAction = (typeof STACK_SERVICE_ACTIONS)[number];

export interface StackServiceCliArgs {
  readonly stack: StackServiceStack;
  readonly service: StackServiceService;
  readonly action: StackServiceAction;
}

export class StackServiceCliArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "StackServiceCliArgumentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class StackServiceCliHelpRequested extends Error {
  public constructor() {
    super("Stack service CLI help requested.");
    this.name = "StackServiceCliHelpRequested";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseStackServiceCliArgs(
  argv: readonly string[],
): StackServiceCliArgs {
  let stack: string | undefined;
  let service: string | undefined;
  let action: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = argv[index];

    if (rawArg === undefined || rawArg === "--") {
      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      throw new StackServiceCliHelpRequested();
    }

    if (rawArg === "--stack") {
      assertOptionNotProvided(stack, "--stack");
      stack = readSeparatedOptionValue(argv, index, "--stack");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--stack=")) {
      assertOptionNotProvided(stack, "--stack");
      stack = readInlineOptionValue(rawArg, "--stack");
      continue;
    }

    if (rawArg === "--service") {
      assertOptionNotProvided(service, "--service");
      service = readSeparatedOptionValue(argv, index, "--service");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--service=")) {
      assertOptionNotProvided(service, "--service");
      service = readInlineOptionValue(rawArg, "--service");
      continue;
    }

    if (rawArg === "--action") {
      assertOptionNotProvided(action, "--action");
      action = readSeparatedOptionValue(argv, index, "--action");
      index += 1;
      continue;
    }

    if (rawArg.startsWith("--action=")) {
      assertOptionNotProvided(action, "--action");
      action = readInlineOptionValue(rawArg, "--action");
      continue;
    }

    if (rawArg.startsWith("-")) {
      throw new StackServiceCliArgumentError(`Unknown option ${rawArg}.`);
    }

    throw new StackServiceCliArgumentError("Unexpected positional argument.");
  }

  if (stack === undefined) {
    throw new StackServiceCliArgumentError("--stack is required.");
  }

  if (service === undefined) {
    throw new StackServiceCliArgumentError("--service is required.");
  }

  if (action === undefined) {
    throw new StackServiceCliArgumentError("--action is required.");
  }

  const normalizedStack = normalizeEnumOption(
    stack,
    "--stack",
    STACK_SERVICE_STACKS,
  );
  const normalizedService = normalizeEnumOption(
    service,
    "--service",
    STACK_SERVICE_SERVICES,
  );
  const normalizedAction = normalizeEnumOption(
    action,
    "--action",
    STACK_SERVICE_ACTIONS,
  );

  if (normalizedService === "all" && normalizedAction === "once") {
    throw new StackServiceCliArgumentError(
      "--service all does not support --action once.",
    );
  }

  return {
    stack: normalizedStack,
    service: normalizedService,
    action: normalizedAction,
  };
}

export function getStackServiceCliUsage(): string {
  return [
    "Usage:",
    "  pnpm stack:service -- --stack <dev|preview> --service <service> --action <start|once|logs>",
    "",
    "Options:",
    "  --stack     Compose stack: dev or preview.",
    "  --service   Service: collector-worker, account-exercise-worker,",
    "              collection-scheduler, profile-home-feed-scheduler,",
    "              profile-home-feed-worker, or all.",
    "  --action    Action: start, once, or logs.",
    "              all supports start and logs only.",
    "",
    "Examples:",
    "  pnpm stack:service -- --stack dev --service all --action start",
    "  pnpm stack:service -- --stack dev --service all --action logs",
    "  pnpm stack:service -- --stack preview --service collector-worker --action once",
    "  pnpm stack:service -- --stack dev --service profile-home-feed-worker --action once",
    "",
    "Old alias mapping (dev and preview):",
    "  worker                      -> collector-worker",
    "  exercise-worker             -> account-exercise-worker",
    "  scheduler                   -> collection-scheduler",
    "  profile-home-feed-scheduler -> profile-home-feed-scheduler",
    "  profile-home-feed-worker    -> profile-home-feed-worker",
    "  workers                     -> all (start and logs only)",
  ].join("\n");
}

function readSeparatedOptionValue(
  argv: readonly string[],
  optionIndex: number,
  optionName: string,
): string {
  const value = argv[optionIndex + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new StackServiceCliArgumentError(`${optionName} requires a value.`);
  }

  return value;
}

function readInlineOptionValue(rawArg: string, optionName: string): string {
  const prefix = `${optionName}=`;
  const value = rawArg.slice(prefix.length);

  if (value.trim().length === 0) {
    throw new StackServiceCliArgumentError(`${optionName} requires a value.`);
  }

  return value;
}

function assertOptionNotProvided(
  existingValue: string | undefined,
  optionName: string,
): void {
  if (existingValue !== undefined) {
    throw new StackServiceCliArgumentError(
      `${optionName} can only be provided once.`,
    );
  }
}

function normalizeEnumOption<T extends string>(
  value: string,
  optionName: string,
  allowedValues: readonly T[],
): T {
  const normalizedValue = value.trim();

  if ((allowedValues as readonly string[]).includes(normalizedValue)) {
    return normalizedValue as T;
  }

  throw new StackServiceCliArgumentError(
    `${optionName} must be one of: ${allowedValues.join(", ")}.`,
  );
}
