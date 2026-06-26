import { describe, expect, it } from "vitest";
import {
  ProfileHomeFeedRunNextCliArgumentError,
  ProfileHomeFeedRunNextCliHelpRequested,
  getProfileHomeFeedRunNextCliUsage,
  parseProfileHomeFeedRunNextCliArgs,
} from "./cli-args";

describe("profile home-feed run-next CLI args", () => {
  it("parses --base-url and --browser-provider", () => {
    expect(
      parseProfileHomeFeedRunNextCliArgs([
        "--base-url",
        "http://localhost:8081",
        "--browser-provider",
        "playwright",
      ]),
    ).toEqual({
      baseUrl: "http://localhost:8081",
      browserProvider: "playwright",
    });
  });

  it("accepts inline --base-url=<url> and --browser-provider=<name>", () => {
    expect(
      parseProfileHomeFeedRunNextCliArgs([
        "--base-url=http://localhost:8082",
        "--browser-provider=cloakbrowser",
      ]),
    ).toEqual({
      baseUrl: "http://localhost:8082",
      browserProvider: "cloakbrowser",
    });
  });

  it("uses environment defaults with PROFILE_HOME_FEED_RUNNER_BASE_URL precedence", () => {
    expect(
      parseProfileHomeFeedRunNextCliArgs([], {
        PROFILE_HOME_FEED_RUNNER_BASE_URL: "http://gateway:3000",
        PROFILE_MANAGER_BASE_URL: "http://ignored:3000",
        BROWSER_PROVIDER: "cloakbrowser",
      }),
    ).toEqual({
      baseUrl: "http://gateway:3000",
      browserProvider: "cloakbrowser",
    });
  });

  it("falls back to PROFILE_MANAGER_BASE_URL then CONTENT_MANAGER_BASE_URL then localhost:3000", () => {
    expect(
      parseProfileHomeFeedRunNextCliArgs([], {
        CONTENT_MANAGER_BASE_URL: "http://content:3000",
      }),
    ).toEqual({
      baseUrl: "http://content:3000",
      browserProvider: "playwright",
    });

    expect(
      parseProfileHomeFeedRunNextCliArgs([], {}),
    ).toEqual({
      baseUrl: "http://localhost:3000",
      browserProvider: "playwright",
    });
  });

  it("throws ProfileHomeFeedRunNextCliHelpRequested for --help / -h", () => {
    expect(() => parseProfileHomeFeedRunNextCliArgs(["--help"])).toThrow(
      ProfileHomeFeedRunNextCliHelpRequested,
    );
    expect(() => parseProfileHomeFeedRunNextCliArgs(["-h"])).toThrow(
      ProfileHomeFeedRunNextCliHelpRequested,
    );
  });

  it("rejects unknown options", () => {
    expect(() =>
      parseProfileHomeFeedRunNextCliArgs(["--once"]),
    ).toThrow(ProfileHomeFeedRunNextCliArgumentError);
  });

  it("rejects invalid base URLs", () => {
    expect(() =>
      parseProfileHomeFeedRunNextCliArgs([
        "--base-url",
        "ftp://example.com",
      ]),
    ).toThrow(ProfileHomeFeedRunNextCliArgumentError);
    expect(() =>
      parseProfileHomeFeedRunNextCliArgs([
        "--base-url",
        "http://user:pass@example.com",
      ]),
    ).toThrow(ProfileHomeFeedRunNextCliArgumentError);
  });

  it("rejects unknown browser providers", () => {
    expect(() =>
      parseProfileHomeFeedRunNextCliArgs([
        "--browser-provider",
        "unknown-provider",
      ]),
    ).toThrow(ProfileHomeFeedRunNextCliArgumentError);
  });

  it("prints the pnpm verb in usage", () => {
    expect(getProfileHomeFeedRunNextCliUsage()).toContain(
      "pnpm operator:profile-home-feed:run-next",
    );
  });
});
