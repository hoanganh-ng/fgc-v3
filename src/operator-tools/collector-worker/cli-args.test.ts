import { describe, expect, it } from "vitest";
import {
  CollectorWorkerCliArgumentError,
  getCollectorWorkerCliUsage,
  parseCollectorWorkerCliArgs,
} from "./cli-args";

describe("collector worker CLI args", () => {
  it("parses one-shot mode with an explicit base URL", () => {
    expect(
      parseCollectorWorkerCliArgs([
        "--base-url",
        "http://localhost:8081",
        "--once",
      ]),
    ).toEqual({
      baseUrl: "http://localhost:8081",
      once: true,
      pollIntervalMs: 5_000,
      browserProvider: "playwright",
    });
  });

  it("parses polling mode and environment fallbacks", () => {
    expect(
      parseCollectorWorkerCliArgs(["--poll-interval-ms=250"], {
        BROWSER_PROVIDER: "cloakbrowser",
        COLLECTOR_WORKER_BASE_URL: "http://localhost:8081",
      }),
    ).toEqual({
      baseUrl: "http://localhost:8081",
      once: false,
      pollIntervalMs: 250,
      browserProvider: "cloakbrowser",
    });
  });

  it("rejects unsafe or invalid options", () => {
    expect(() =>
      parseCollectorWorkerCliArgs([
        "--base-url",
        "http://user:password@localhost:8081",
      ]),
    ).toThrow(CollectorWorkerCliArgumentError);
    expect(() =>
      parseCollectorWorkerCliArgs(["--poll-interval-ms", "0"]),
    ).toThrow(CollectorWorkerCliArgumentError);
    expect(() => parseCollectorWorkerCliArgs(["--wat"])).toThrow(
      CollectorWorkerCliArgumentError,
    );
    expect(() =>
      parseCollectorWorkerCliArgs(["--browser-provider", "unknown"]),
    ).toThrow(CollectorWorkerCliArgumentError);
  });

  it("documents one-shot and polling usage", () => {
    const usage = getCollectorWorkerCliUsage();

    expect(usage).toContain("pnpm collector:worker:run");
    expect(usage).toContain("--once");
    expect(usage).toContain("--poll-interval-ms");
    expect(usage).toContain("--browser-provider");
    expect(usage).toContain("http://localhost:3000");
  });
});
