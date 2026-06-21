import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_HOME_FEED_WORKER_POLL_INTERVAL_MS,
  ProfileHomeFeedWorkerCliArgumentError,
  ProfileHomeFeedWorkerCliHelpRequested,
  getProfileHomeFeedWorkerCliUsage,
  parseProfileHomeFeedWorkerCliArgs,
} from "./cli-args";

describe("profile home-feed worker CLI args", () => {
  it("parses worker options", () => {
    expect(
      parseProfileHomeFeedWorkerCliArgs([
        "--once",
        "--base-url",
        "http://localhost:8081",
        "--browser-provider",
        "playwright",
        "--poll-interval-ms",
        "100",
      ]),
    ).toEqual({
      baseUrl: "http://localhost:8081",
      browserProvider: "playwright",
      once: true,
      pollIntervalMs: 100,
    });
  });

  it("accepts inline options", () => {
    expect(
      parseProfileHomeFeedWorkerCliArgs([
        "--base-url=http://localhost:8082",
        "--browser-provider=cloakbrowser",
        "--poll-interval-ms=250",
      ]),
    ).toEqual({
      baseUrl: "http://localhost:8082",
      browserProvider: "cloakbrowser",
      once: false,
      pollIntervalMs: 250,
    });
  });

  it("uses the existing run-next defaults", () => {
    expect(
      parseProfileHomeFeedWorkerCliArgs([], {
        PROFILE_HOME_FEED_RUNNER_BASE_URL: "http://gateway:3000",
        PROFILE_MANAGER_BASE_URL: "http://ignored:3000",
        CONTENT_MANAGER_BASE_URL: "http://also-ignored:3000",
        BROWSER_PROVIDER: "cloakbrowser",
      }),
    ).toEqual({
      baseUrl: "http://gateway:3000",
      browserProvider: "cloakbrowser",
      once: false,
      pollIntervalMs: DEFAULT_PROFILE_HOME_FEED_WORKER_POLL_INTERVAL_MS,
    });
  });

  it("falls back to profile manager, content manager, then localhost base URL", () => {
    expect(
      parseProfileHomeFeedWorkerCliArgs([], {
        PROFILE_MANAGER_BASE_URL: "http://profiles:3000",
        CONTENT_MANAGER_BASE_URL: "http://content:3000",
      }).baseUrl,
    ).toBe("http://profiles:3000");

    expect(
      parseProfileHomeFeedWorkerCliArgs([], {
        CONTENT_MANAGER_BASE_URL: "http://content:3000",
      }).baseUrl,
    ).toBe("http://content:3000");

    expect(parseProfileHomeFeedWorkerCliArgs([], {}).baseUrl).toBe(
      "http://localhost:3000",
    );
  });

  it("throws ProfileHomeFeedWorkerCliHelpRequested for --help / -h", () => {
    expect(() => parseProfileHomeFeedWorkerCliArgs(["--help"])).toThrow(
      ProfileHomeFeedWorkerCliHelpRequested,
    );
    expect(() => parseProfileHomeFeedWorkerCliArgs(["-h"])).toThrow(
      ProfileHomeFeedWorkerCliHelpRequested,
    );
  });

  it("rejects invalid options", () => {
    expect(() =>
      parseProfileHomeFeedWorkerCliArgs(["--base-url", "ftp://example.com"]),
    ).toThrow(ProfileHomeFeedWorkerCliArgumentError);
    expect(() =>
      parseProfileHomeFeedWorkerCliArgs([
        "--base-url",
        "http://user:pass@example.com",
      ]),
    ).toThrow(ProfileHomeFeedWorkerCliArgumentError);
    expect(() =>
      parseProfileHomeFeedWorkerCliArgs(["--poll-interval-ms", "0"]),
    ).toThrow(ProfileHomeFeedWorkerCliArgumentError);
    expect(() =>
      parseProfileHomeFeedWorkerCliArgs([
        "--browser-provider",
        "unknown-provider",
      ]),
    ).toThrow(ProfileHomeFeedWorkerCliArgumentError);
  });

  it("prints canonical and alias commands in usage", () => {
    const usage = getProfileHomeFeedWorkerCliUsage();

    expect(usage).toContain("pnpm operator:profile-home-feed-worker");
    expect(usage).toContain("pnpm profile-home-feed-worker:run");
  });
});
