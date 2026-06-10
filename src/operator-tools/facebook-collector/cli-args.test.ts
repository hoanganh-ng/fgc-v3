import { describe, expect, it } from "vitest";
import {
  DEFAULT_FACEBOOK_COLLECTOR_BASE_URL,
  DEFAULT_FACEBOOK_COLLECTOR_MAX_DURATION_MS,
  DEFAULT_FACEBOOK_COLLECTOR_MAX_SCROLLS,
  FacebookCollectorCliArgumentError,
  FacebookCollectorCliHelpRequested,
  getFacebookCollectorCliUsage,
  parseFacebookCollectorCliArgs,
} from "./cli-args";

describe("parseFacebookCollectorCliArgs", () => {
  it("parses explicit operator options", () => {
    expect(
      parseFacebookCollectorCliArgs([
        "--source-group-id",
        " source-group-1 ",
        "--base-url",
        " http://localhost:8081 ",
        "--max-scrolls",
        "5",
        "--max-duration-ms",
        "45000",
        "--diagnose-checkout",
      ]),
    ).toEqual({
      sourceGroupId: "source-group-1",
      baseUrl: "http://localhost:8081",
      maxScrolls: 5,
      maxDurationMs: 45_000,
      diagnoseCheckout: true,
    });
  });

  it("supports inline options, the pnpm separator, and the dev group URL override", () => {
    expect(
      parseFacebookCollectorCliArgs([
        "--",
        "--source-group-id=source-group-1",
        "--group-url=https://m.facebook.com/groups/12345/",
        "--base-url=https://gateway.example.test",
      ]),
    ).toEqual({
      groupUrl: "https://m.facebook.com/groups/12345/",
      sourceGroupId: "source-group-1",
      baseUrl: "https://gateway.example.test",
      maxScrolls: DEFAULT_FACEBOOK_COLLECTOR_MAX_SCROLLS,
      maxDurationMs: DEFAULT_FACEBOOK_COLLECTOR_MAX_DURATION_MS,
      diagnoseCheckout: false,
    });
  });

  it("uses environment base URL defaults before the local API default", () => {
    expect(
      parseFacebookCollectorCliArgs(
        ["--source-group-id", "source-group-1"],
        {
          COLLECTOR_FACEBOOK_BASE_URL: " http://localhost:8081 ",
          PROFILE_MANAGER_BASE_URL: "http://localhost:3000",
        },
      ),
    ).toMatchObject({
      baseUrl: "http://localhost:8081",
    });

    expect(
      parseFacebookCollectorCliArgs(
        ["--source-group-id", "source-group-1"],
        {
          PROFILE_MANAGER_BASE_URL: " http://localhost:3000 ",
          CONTENT_MANAGER_BASE_URL: "http://localhost:3001",
        },
      ),
    ).toMatchObject({
      baseUrl: "http://localhost:3000",
    });

    expect(
      parseFacebookCollectorCliArgs(["--source-group-id", "source-group-1"]),
    ).toMatchObject({
      baseUrl: DEFAULT_FACEBOOK_COLLECTOR_BASE_URL,
    });
  });

  it("fails safely for missing required values and unexpected options", () => {
    expect(() => parseFacebookCollectorCliArgs([])).toThrow(
      new FacebookCollectorCliArgumentError("--source-group-id is required."),
    );
    expect(() =>
      parseFacebookCollectorCliArgs(["--source-group-id", " "]),
    ).toThrow("--source-group-id must be a non-empty id.");
    expect(() =>
      parseFacebookCollectorCliArgs(["--source-group-id", "--base-url"]),
    ).toThrow("--source-group-id requires a value.");
    expect(() =>
      parseFacebookCollectorCliArgs([
        "--source-group-id",
        "source-group-1",
        "unexpected",
      ]),
    ).toThrow("Unexpected positional argument.");
    expect(() =>
      parseFacebookCollectorCliArgs([
        "--source-group-id",
        "source-group-1",
        "--wat",
      ]),
    ).toThrow("Unknown option --wat.");
  });

  it("rejects invalid URLs, embedded credentials, and non-group URLs", () => {
    expect(() =>
      parseFacebookCollectorCliArgs([
        "--source-group-id",
        "source-group-1",
        "--group-url",
        "https://example.com/groups/group-1",
      ]),
    ).toThrow("--group-url must point to facebook.com.");
    expect(() =>
      parseFacebookCollectorCliArgs([
        "--source-group-id",
        "source-group-1",
        "--group-url",
        "https://user:secret@www.facebook.com/groups/group-1",
      ]),
    ).toThrow("--group-url must not contain embedded credentials.");
    expect(() =>
      parseFacebookCollectorCliArgs([
        "--source-group-id",
        "source-group-1",
        "--group-url",
        "https://www.facebook.com/profile.php?id=1",
      ]),
    ).toThrow("--group-url must point to a Facebook group.");
    expect(() =>
      parseFacebookCollectorCliArgs([
        "--source-group-id",
        "source-group-1",
        "--group-url",
        "https://www.facebook.com/groups/group-1",
        "--base-url",
        "ftp://localhost",
      ]),
    ).toThrow("--base-url must use http or https.");
  });

  it("validates stop condition options", () => {
    expect(() =>
      parseFacebookCollectorCliArgs([
        "--source-group-id",
        "source-group-1",
        "--max-scrolls",
        "-1",
      ]),
    ).toThrow("--max-scrolls must be a non-negative integer.");
    expect(() =>
      parseFacebookCollectorCliArgs([
        "--source-group-id",
        "source-group-1",
        "--max-duration-ms",
        "0",
      ]),
    ).toThrow("--max-duration-ms must be a positive integer.");
  });

  it("throws a dedicated help signal and includes safe usage text", () => {
    expect(() => parseFacebookCollectorCliArgs(["--help"])).toThrow(
      FacebookCollectorCliHelpRequested,
    );
    expect(getFacebookCollectorCliUsage()).toContain(
      "pnpm collector:facebook:run -- --source-group-id",
    );
    expect(getFacebookCollectorCliUsage()).toContain("--diagnose-checkout");
    expect(getFacebookCollectorCliUsage()).not.toContain("password");
  });
});
