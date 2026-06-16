import { describe, expect, it } from "vitest";
import {
  ProfileSourceAccessCheckWorkerCliArgumentError,
  ProfileSourceAccessCheckWorkerCliHelpRequested,
  getProfileSourceAccessCheckWorkerCliUsage,
  parseProfileSourceAccessCheckWorkerCliArgs,
} from "./cli-args";

describe("profile-source access check worker CLI args", () => {
  it("parses worker options", () => {
    expect(
      parseProfileSourceAccessCheckWorkerCliArgs([
        "--base-url",
        "http://localhost:8081",
        "--browser-provider",
        "playwright",
        "--poll-interval-ms",
        "100",
        "--once",
      ]),
    ).toEqual({
      baseUrl: "http://localhost:8081",
      browserProvider: "playwright",
      pollIntervalMs: 100,
      once: true,
    });
  });

  it("uses environment defaults", () => {
    expect(
      parseProfileSourceAccessCheckWorkerCliArgs([], {
        PROFILE_SOURCE_ACCESS_CHECK_WORKER_BASE_URL: "http://localhost:3000",
        BROWSER_PROVIDER: "cloakbrowser",
      }),
    ).toMatchObject({
      baseUrl: "http://localhost:3000",
      browserProvider: "cloakbrowser",
    });
  });

  it("throws for help", () => {
    expect(() => parseProfileSourceAccessCheckWorkerCliArgs(["--help"])).toThrow(
      ProfileSourceAccessCheckWorkerCliHelpRequested,
    );
  });

  it("prints canonical and alias commands in usage", () => {
    const usage = getProfileSourceAccessCheckWorkerCliUsage();

    expect(usage).toContain("pnpm operator:profile-source-access-check-worker");
    expect(usage).toContain("pnpm profile-source-access-check-worker:run");
  });

  it("rejects invalid options", () => {
    expect(() =>
      parseProfileSourceAccessCheckWorkerCliArgs(["--base-url", "ftp://example.com"]),
    ).toThrow(ProfileSourceAccessCheckWorkerCliArgumentError);
    expect(() =>
      parseProfileSourceAccessCheckWorkerCliArgs(["--poll-interval-ms", "0"]),
    ).toThrow(ProfileSourceAccessCheckWorkerCliArgumentError);
  });
});
