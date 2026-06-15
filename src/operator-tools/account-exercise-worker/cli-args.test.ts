import { describe, expect, it } from "vitest";
import {
  AccountExerciseWorkerCliArgumentError,
  AccountExerciseWorkerCliHelpRequested,
  getAccountExerciseWorkerCliUsage,
  parseAccountExerciseWorkerCliArgs,
} from "./cli-args";

describe("account exercise worker CLI args", () => {
  it("parses worker options", () => {
    expect(
      parseAccountExerciseWorkerCliArgs([
        "--base-url",
        "http://localhost:8081",
        "--once",
        "--poll-interval-ms",
        "250",
        "--browser-provider",
        "playwright",
      ]),
    ).toEqual({
      baseUrl: "http://localhost:8081",
      once: true,
      pollIntervalMs: 250,
      browserProvider: "playwright",
    });
  });

  it("uses environment fallbacks", () => {
    expect(
      parseAccountExerciseWorkerCliArgs([], {
        ACCOUNT_EXERCISE_WORKER_BASE_URL: "http://localhost:8081",
        BROWSER_PROVIDER: "cloakbrowser",
      }),
    ).toEqual({
      baseUrl: "http://localhost:8081",
      once: false,
      pollIntervalMs: 5_000,
      browserProvider: "cloakbrowser",
    });
  });

  it("prints help with canonical and alias commands", () => {
    expect(() => parseAccountExerciseWorkerCliArgs(["--help"])).toThrow(
      AccountExerciseWorkerCliHelpRequested,
    );

    const usage = getAccountExerciseWorkerCliUsage();

    expect(usage).toContain("pnpm operator:profile:exercise-worker");
    expect(usage).toContain("pnpm profile:exercise-worker:run");
  });

  it("rejects invalid base URLs and poll intervals", () => {
    expect(() =>
      parseAccountExerciseWorkerCliArgs(["--base-url", "ftp://example.com"]),
    ).toThrow(AccountExerciseWorkerCliArgumentError);
    expect(() =>
      parseAccountExerciseWorkerCliArgs(["--poll-interval-ms", "0"]),
    ).toThrow(AccountExerciseWorkerCliArgumentError);
  });
});
