import { EventEmitter } from "node:events";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  launchStackServiceCommand,
  StackServiceSpawnError,
  stackServiceLaunchExitCode,
} from "./launch-process";

class FakeChildProcess extends EventEmitter {
  public readonly stdin = null;
  public readonly stdout = null;
  public readonly stderr = null;
  public readonly pid = 4242;
}

describe("launchStackServiceCommand", () => {
  it("spawns without a shell and inherits stdio", async () => {
    const spawnFn = vi.fn(
      (_command: string, _args: readonly string[], _options: SpawnOptions) => {
        const child = new FakeChildProcess();
        queueMicrotask(() => {
          child.emit("close", 0, null);
        });
        return child as unknown as ChildProcess;
      },
    );

    const result = await launchStackServiceCommand(
      {
        executable: "docker",
        args: ["compose", "-f", "docker-compose.dev.yml", "logs", "-f", "collector-worker"],
      },
      spawnFn,
    );

    expect(spawnFn).toHaveBeenCalledWith(
      "docker",
      ["compose", "-f", "docker-compose.dev.yml", "logs", "-f", "collector-worker"],
      {
        stdio: "inherit",
        shell: false,
      },
    );
    expect(result).toEqual({ exitCode: 0, signal: null });
    expect(stackServiceLaunchExitCode(result)).toBe(0);
  });

  it("propagates non-zero exit codes", async () => {
    const spawnFn = vi.fn(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => {
        child.emit("close", 7, null);
      });
      return child as unknown as ChildProcess;
    });

    const result = await launchStackServiceCommand(
      { executable: "docker", args: ["compose"] },
      spawnFn,
    );

    expect(result).toEqual({ exitCode: 7, signal: null });
    expect(stackServiceLaunchExitCode(result)).toBe(7);
  });

  it("propagates signal termination as 128 + signal number", async () => {
    const spawnFn = vi.fn(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => {
        child.emit("close", null, "SIGTERM");
      });
      return child as unknown as ChildProcess;
    });

    const result = await launchStackServiceCommand(
      { executable: "docker", args: ["compose"] },
      spawnFn,
    );

    expect(result).toEqual({ exitCode: 143, signal: "SIGTERM" });
    expect(stackServiceLaunchExitCode(result)).toBe(143);
  });

  it("propagates spawn failures", async () => {
    const spawnFn = vi.fn(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => {
        child.emit("error", new Error("ENOENT"));
      });
      return child as unknown as ChildProcess;
    });

    await expect(
      launchStackServiceCommand(
        { executable: "docker", args: ["compose"] },
        spawnFn,
      ),
    ).rejects.toBeInstanceOf(StackServiceSpawnError);
  });

  it("propagates synchronous spawn throws", async () => {
    const spawnFn = vi.fn(() => {
      throw new Error("spawn blocked");
    });

    await expect(
      launchStackServiceCommand(
        { executable: "docker", args: ["compose"] },
        spawnFn,
      ),
    ).rejects.toThrow("Failed to spawn docker: spawn blocked");
  });
});
