import { describe, expect, it } from "vitest";
import {
  buildStackServiceCommand,
  STACK_SERVICE_AGGREGATE_ORDER,
  STACK_SERVICE_ONCE_ENV_VARS,
  type StackServiceConcreteService,
} from "./build-command";
import type { StackServiceAction, StackServiceService } from "./cli-args";

const ALL_SERVICES = [...STACK_SERVICE_AGGREGATE_ORDER];

describe("buildStackServiceCommand", () => {
  it("builds start, once, and logs for every concrete service on both stacks", () => {
    for (const stack of ["dev", "preview"] as const) {
      const composeFile =
        stack === "dev"
          ? "docker-compose.dev.yml"
          : "docker-compose.preview.yml";

      for (const service of STACK_SERVICE_AGGREGATE_ORDER) {
        expect(
          buildStackServiceCommand({
            stack,
            service,
            action: "start",
          }),
        ).toEqual({
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
            service,
          ],
        });

        expect(
          buildStackServiceCommand({
            stack,
            service,
            action: "logs",
          }),
        ).toEqual({
          executable: "docker",
          args: ["compose", "-f", composeFile, "logs", "-f", service],
        });

        expect(
          buildStackServiceCommand({
            stack,
            service,
            action: "once",
          }),
        ).toEqual({
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
            `${STACK_SERVICE_ONCE_ENV_VARS[service]}=--once`,
            service,
          ],
        });
      }
    }
  });

  it("expands all in the existing aggregate order for start and logs", () => {
    expect(
      buildStackServiceCommand({
        stack: "dev",
        service: "all",
        action: "start",
      }),
    ).toEqual({
      executable: "docker",
      args: [
        "compose",
        "-f",
        "docker-compose.dev.yml",
        "--profile",
        "worker",
        "up",
        "--build",
        "-d",
        ...ALL_SERVICES,
      ],
    });

    expect(
      buildStackServiceCommand({
        stack: "preview",
        service: "all",
        action: "logs",
      }),
    ).toEqual({
      executable: "docker",
      args: [
        "compose",
        "-f",
        "docker-compose.preview.yml",
        "logs",
        "-f",
        ...ALL_SERVICES,
      ],
    });
  });

  it("matches every removed alias argument sequence exactly", () => {
    const aliasSegments: readonly {
      readonly segment: string;
      readonly service: StackServiceService;
      readonly actions: readonly StackServiceAction[];
    }[] = [
      {
        segment: "worker",
        service: "collector-worker",
        actions: ["start", "once", "logs"],
      },
      {
        segment: "exercise-worker",
        service: "account-exercise-worker",
        actions: ["start", "once", "logs"],
      },
      {
        segment: "scheduler",
        service: "collection-scheduler",
        actions: ["start", "once", "logs"],
      },
      {
        segment: "profile-home-feed-scheduler",
        service: "profile-home-feed-scheduler",
        actions: ["start", "once", "logs"],
      },
      {
        segment: "profile-home-feed-worker",
        service: "profile-home-feed-worker",
        actions: ["start", "once", "logs"],
      },
      {
        segment: "workers",
        service: "all",
        actions: ["start", "logs"],
      },
    ];

    const expectedByAlias = buildExpectedAliasArgumentMatrix();

    expect(Object.keys(expectedByAlias)).toHaveLength(34);

    for (const stack of ["dev", "preview"] as const) {
      for (const aliasSegment of aliasSegments) {
        for (const action of aliasSegment.actions) {
          const alias = `stack:${stack}:${aliasSegment.segment}:${action}`;
          const built = buildStackServiceCommand({
            stack,
            service: aliasSegment.service,
            action,
          });

          expect(built.executable).toBe("docker");
          expect(built.args).toEqual(expectedByAlias[alias]);
        }
      }
    }
  });
});

function buildExpectedAliasArgumentMatrix(): Readonly<
  Record<string, readonly string[]>
> {
  const servicesFor = (service: StackServiceService): readonly string[] =>
    service === "all" ? ALL_SERVICES : [service];

  const matrix: Record<string, readonly string[]> = {};

  const add = (
    stack: "dev" | "preview",
    segment: string,
    service: StackServiceService,
    action: StackServiceAction,
  ): void => {
    const composeFile =
      stack === "dev"
        ? "docker-compose.dev.yml"
        : "docker-compose.preview.yml";
    const services = servicesFor(service);
    const alias = `stack:${stack}:${segment}:${action}`;

    if (action === "start") {
      matrix[alias] = [
        "compose",
        "-f",
        composeFile,
        "--profile",
        "worker",
        "up",
        "--build",
        "-d",
        ...services,
      ];
      return;
    }

    if (action === "logs") {
      matrix[alias] = ["compose", "-f", composeFile, "logs", "-f", ...services];
      return;
    }

    const concreteService = services[0] as
      | StackServiceConcreteService
      | undefined;
    if (concreteService === undefined) {
      throw new Error(`missing concrete service for ${alias}`);
    }

    matrix[alias] = [
      "compose",
      "-f",
      composeFile,
      "--profile",
      "worker",
      "run",
      "--rm",
      "--build",
      "-e",
      `${STACK_SERVICE_ONCE_ENV_VARS[concreteService]}=--once`,
      concreteService,
    ];
  };

  for (const stack of ["dev", "preview"] as const) {
    add(stack, "worker", "collector-worker", "start");
    add(stack, "worker", "collector-worker", "once");
    add(stack, "worker", "collector-worker", "logs");
    add(stack, "exercise-worker", "account-exercise-worker", "start");
    add(stack, "exercise-worker", "account-exercise-worker", "once");
    add(stack, "exercise-worker", "account-exercise-worker", "logs");
    add(stack, "scheduler", "collection-scheduler", "start");
    add(stack, "scheduler", "collection-scheduler", "once");
    add(stack, "scheduler", "collection-scheduler", "logs");
    add(
      stack,
      "profile-home-feed-scheduler",
      "profile-home-feed-scheduler",
      "start",
    );
    add(
      stack,
      "profile-home-feed-scheduler",
      "profile-home-feed-scheduler",
      "once",
    );
    add(
      stack,
      "profile-home-feed-scheduler",
      "profile-home-feed-scheduler",
      "logs",
    );
    add(stack, "profile-home-feed-worker", "profile-home-feed-worker", "start");
    add(stack, "profile-home-feed-worker", "profile-home-feed-worker", "once");
    add(stack, "profile-home-feed-worker", "profile-home-feed-worker", "logs");
    add(stack, "workers", "all", "start");
    add(stack, "workers", "all", "logs");
  }

  return matrix;
}
