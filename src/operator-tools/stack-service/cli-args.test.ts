import { describe, expect, it } from "vitest";
import {
  getStackServiceCliUsage,
  parseStackServiceCliArgs,
  StackServiceCliArgumentError,
  StackServiceCliHelpRequested,
} from "./cli-args";

describe("stack service CLI args", () => {
  it("parses separated and inline option forms", () => {
    expect(
      parseStackServiceCliArgs([
        "--stack",
        "dev",
        "--service",
        "profile-home-feed-worker",
        "--action",
        "once",
      ]),
    ).toEqual({
      stack: "dev",
      service: "profile-home-feed-worker",
      action: "once",
    });

    expect(
      parseStackServiceCliArgs([
        "--stack=preview",
        "--service=all",
        "--action=logs",
      ]),
    ).toEqual({
      stack: "preview",
      service: "all",
      action: "logs",
    });
  });

  it("rejects all + once before any command is built", () => {
    expect(() =>
      parseStackServiceCliArgs([
        "--stack",
        "dev",
        "--service",
        "all",
        "--action",
        "once",
      ]),
    ).toThrow(StackServiceCliArgumentError);
    expect(() =>
      parseStackServiceCliArgs([
        "--stack",
        "dev",
        "--service",
        "all",
        "--action",
        "once",
      ]),
    ).toThrow("--service all does not support --action once.");
  });

  it("rejects missing, duplicated, unknown, and extra arguments", () => {
    expect(() => parseStackServiceCliArgs([])).toThrow("--stack is required.");
    expect(() =>
      parseStackServiceCliArgs(["--stack", "dev", "--service", "all"]),
    ).toThrow("--action is required.");
    expect(() =>
      parseStackServiceCliArgs([
        "--stack",
        "dev",
        "--stack",
        "preview",
        "--service",
        "all",
        "--action",
        "start",
      ]),
    ).toThrow("--stack can only be provided once.");
    expect(() =>
      parseStackServiceCliArgs([
        "--stack",
        "qa",
        "--service",
        "all",
        "--action",
        "start",
      ]),
    ).toThrow("--stack must be one of: dev, preview.");
    expect(() =>
      parseStackServiceCliArgs([
        "--stack",
        "dev",
        "--service",
        "all",
        "--action",
        "start",
        "--wat",
      ]),
    ).toThrow("Unknown option --wat.");
    expect(() =>
      parseStackServiceCliArgs([
        "--stack",
        "dev",
        "--service",
        "all",
        "--action",
        "start",
        "extra",
      ]),
    ).toThrow("Unexpected positional argument.");
  });

  it("exposes help without requiring other options", () => {
    expect(() => parseStackServiceCliArgs(["--help"])).toThrow(
      StackServiceCliHelpRequested,
    );

    const usage = getStackServiceCliUsage();
    expect(usage).toContain("pnpm stack:service --");
    expect(usage).toContain("--stack");
    expect(usage).toContain("--service");
    expect(usage).toContain("--action");
    expect(usage).toContain("collector-worker");
    expect(usage).toContain("all supports start and logs only");
    expect(usage).toContain("worker                      -> collector-worker");
  });
});
