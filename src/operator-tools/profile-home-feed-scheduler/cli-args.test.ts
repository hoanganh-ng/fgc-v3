import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_HOME_FEED_SCHEDULER_POLL_INTERVAL_MS,
  ProfileHomeFeedSchedulerCliArgumentError,
  ProfileHomeFeedSchedulerCliHelpRequested,
  getProfileHomeFeedSchedulerCliUsage,
  parseProfileHomeFeedSchedulerCliArgs,
} from "./cli-args";

describe("profile home-feed scheduler CLI args", () => {
  it("returns defaults when no arguments are provided", () => {
    expect(parseProfileHomeFeedSchedulerCliArgs([])).toEqual({
      once: false,
      pollIntervalMs: DEFAULT_PROFILE_HOME_FEED_SCHEDULER_POLL_INTERVAL_MS,
    });
  });

  it("parses --once with the default poll interval", () => {
    expect(parseProfileHomeFeedSchedulerCliArgs(["--once"])).toEqual({
      once: true,
      pollIntervalMs: DEFAULT_PROFILE_HOME_FEED_SCHEDULER_POLL_INTERVAL_MS,
    });
  });

  it("parses --poll-interval-ms in separated form", () => {
    expect(
      parseProfileHomeFeedSchedulerCliArgs(["--poll-interval-ms", "250"]),
    ).toEqual({
      once: false,
      pollIntervalMs: 250,
    });
  });

  it("parses --poll-interval-ms in inline form", () => {
    expect(
      parseProfileHomeFeedSchedulerCliArgs(["--poll-interval-ms=250"]),
    ).toEqual({
      once: false,
      pollIntervalMs: 250,
    });
  });

  it("parses --once together with --poll-interval-ms", () => {
    expect(
      parseProfileHomeFeedSchedulerCliArgs([
        "--once",
        "--poll-interval-ms",
        "100",
      ]),
    ).toEqual({
      once: true,
      pollIntervalMs: 100,
    });
  });

  it("signals help on --help", () => {
    expect(() => parseProfileHomeFeedSchedulerCliArgs(["--help"])).toThrow(
      ProfileHomeFeedSchedulerCliHelpRequested,
    );
  });

  it("signals help on -h", () => {
    expect(() => parseProfileHomeFeedSchedulerCliArgs(["-h"])).toThrow(
      ProfileHomeFeedSchedulerCliHelpRequested,
    );
  });

  it("rejects duplicate --once", () => {
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs(["--once", "--once"]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
  });

  it("rejects duplicate --poll-interval-ms across separated and inline forms", () => {
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs([
        "--poll-interval-ms",
        "250",
        "--poll-interval-ms=500",
      ]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs([
        "--poll-interval-ms=250",
        "--poll-interval-ms",
        "500",
      ]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
  });

  it("rejects unknown flags", () => {
    expect(() => parseProfileHomeFeedSchedulerCliArgs(["--bogus"])).toThrow(
      ProfileHomeFeedSchedulerCliArgumentError,
    );
  });

  it("rejects positional arguments", () => {
    expect(() => parseProfileHomeFeedSchedulerCliArgs(["foo"])).toThrow(
      ProfileHomeFeedSchedulerCliArgumentError,
    );
  });

  it("rejects --poll-interval-ms with no value", () => {
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs(["--poll-interval-ms"]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs(["--poll-interval-ms", "--once"]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
  });

  it("rejects nonnumeric --poll-interval-ms values", () => {
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs(["--poll-interval-ms", "abc"]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
  });

  it("rejects fractional --poll-interval-ms values", () => {
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs(["--poll-interval-ms", "1.5"]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs(["--poll-interval-ms=1.5"]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
  });

  it("rejects zero and negative --poll-interval-ms values", () => {
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs(["--poll-interval-ms", "0"]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs(["--poll-interval-ms=-1"]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs(["--poll-interval-ms", "-50"]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
  });

  it("rejects empty inline --poll-interval-ms values", () => {
    expect(() =>
      parseProfileHomeFeedSchedulerCliArgs(["--poll-interval-ms="]),
    ).toThrow(ProfileHomeFeedSchedulerCliArgumentError);
  });

  it("documents usage", () => {
    const usage = getProfileHomeFeedSchedulerCliUsage();

    expect(usage).toContain("pnpm operator:profile-home-feed:scheduler");
    expect(usage).toContain("--once");
    expect(usage).toContain("--poll-interval-ms");
    expect(usage).toContain("--help");
    expect(usage).toContain("-h");
  });

  it("states that DATABASE_URL is required for production composition", () => {
    const usage = getProfileHomeFeedSchedulerCliUsage();

    expect(usage).toContain("DATABASE_URL");
    expect(usage).toContain("required");
  });
});
