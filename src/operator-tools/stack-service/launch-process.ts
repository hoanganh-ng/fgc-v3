import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import type { StackServiceCommand } from "./build-command";

export type StackServiceSpawnFn = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess;

export class StackServiceSpawnError extends Error {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StackServiceSpawnError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface StackServiceLaunchResult {
  readonly exitCode: number;
  readonly signal: NodeJS.Signals | null;
}

const SIGNAL_EXIT_CODES: Readonly<Partial<Record<NodeJS.Signals, number>>> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGKILL: 9,
  SIGTERM: 15,
};

export async function launchStackServiceCommand(
  command: StackServiceCommand,
  spawnFn: StackServiceSpawnFn = spawn,
): Promise<StackServiceLaunchResult> {
  return await new Promise<StackServiceLaunchResult>((resolve, reject) => {
    let child: ChildProcess;

    try {
      child = spawnFn(command.executable, [...command.args], {
        stdio: "inherit",
        shell: false,
      });
    } catch (error) {
      reject(
        new StackServiceSpawnError(
          `Failed to spawn ${command.executable}: ${formatUnknownError(error)}`,
          { cause: error },
        ),
      );
      return;
    }

    child.once("error", (error) => {
      reject(
        new StackServiceSpawnError(
          `Failed to spawn ${command.executable}: ${formatUnknownError(error)}`,
          { cause: error },
        ),
      );
    });

    child.once("close", (code, signal) => {
      if (signal !== null) {
        resolve({
          exitCode: signalToExitCode(signal),
          signal,
        });
        return;
      }

      resolve({
        exitCode: code ?? 1,
        signal: null,
      });
    });
  });
}

export function stackServiceLaunchExitCode(
  result: StackServiceLaunchResult,
): number {
  return result.exitCode;
}

function signalToExitCode(signal: NodeJS.Signals): number {
  const signalNumber = SIGNAL_EXIT_CODES[signal];
  if (signalNumber === undefined) {
    return 1;
  }

  return 128 + signalNumber;
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "unknown spawn failure";
}
