import type {
  StackServiceCliArgs,
  StackServiceService,
  StackServiceStack,
} from "./cli-args";

export const STACK_SERVICE_COMPOSE_FILES = {
  dev: "docker-compose.dev.yml",
  preview: "docker-compose.preview.yml",
} as const satisfies Record<StackServiceStack, string>;

export const STACK_SERVICE_AGGREGATE_ORDER = [
  "collector-worker",
  "account-exercise-worker",
  "collection-scheduler",
  "profile-home-feed-scheduler",
  "profile-home-feed-worker",
] as const;

export type StackServiceConcreteService =
  (typeof STACK_SERVICE_AGGREGATE_ORDER)[number];

export const STACK_SERVICE_ONCE_ENV_VARS = {
  "collector-worker": "COLLECTOR_WORKER_MODE_ARGS",
  "account-exercise-worker": "ACCOUNT_EXERCISE_WORKER_MODE_ARGS",
  "collection-scheduler": "COLLECTION_SCHEDULER_MODE_ARGS",
  "profile-home-feed-scheduler": "PROFILE_HOME_FEED_SCHEDULER_MODE_ARGS",
  "profile-home-feed-worker": "PROFILE_HOME_FEED_WORKER_MODE_ARGS",
} as const satisfies Record<StackServiceConcreteService, string>;

export interface StackServiceCommand {
  readonly executable: string;
  readonly args: readonly string[];
}

export function buildStackServiceCommand(
  options: StackServiceCliArgs,
): StackServiceCommand {
  const composeFile = STACK_SERVICE_COMPOSE_FILES[options.stack];
  const services = resolveServices(options.service);

  if (options.action === "start") {
    return {
      executable: "docker",
      args: [
        "compose",
        "-f",
        composeFile,
        "--profile",
        "worker",
        "up",
        "--build",
        "-d",
        ...services,
      ],
    };
  }

  if (options.action === "logs") {
    return {
      executable: "docker",
      args: ["compose", "-f", composeFile, "logs", "-f", ...services],
    };
  }

  const service = services[0];
  if (service === undefined || services.length !== 1) {
    throw new Error("once action requires exactly one concrete service.");
  }

  const modeEnvVar = STACK_SERVICE_ONCE_ENV_VARS[service];

  return {
    executable: "docker",
    args: [
      "compose",
      "-f",
      composeFile,
      "--profile",
      "worker",
      "run",
      "--rm",
      "--build",
      "-e",
      `${modeEnvVar}=--once`,
      service,
    ],
  };
}

function resolveServices(
  service: StackServiceService,
): readonly StackServiceConcreteService[] {
  if (service === "all") {
    return STACK_SERVICE_AGGREGATE_ORDER;
  }

  return [service];
}
