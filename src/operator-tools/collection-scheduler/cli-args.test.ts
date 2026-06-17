import { describe, expect, it } from "vitest";
import {
  CollectionSchedulerCliArgumentError,
  CollectionSchedulerCliHelpRequested,
  DEFAULT_COLLECTION_SCHEDULER_POLL_INTERVAL_MS,
  getCollectionSchedulerCliUsage,
  parseCollectionSchedulerCliArgs,
} from "./cli-args";

describe("collection scheduler CLI args", () => {
  it("returns defaults when no arguments are provided", () => {
    expect(parseCollectionSchedulerCliArgs([])).toEqual({
      once: false,
      pollIntervalMs: DEFAULT_COLLECTION_SCHEDULER_POLL_INTERVAL_MS,
    });
  });

  it("parses --once with the default poll interval", () => {
    expect(parseCollectionSchedulerCliArgs(["--once"])).toEqual({
      once: true,
      pollIntervalMs: DEFAULT_COLLECTION_SCHEDULER_POLL_INTERVAL_MS,
    });
  });

  it("parses --poll-interval-ms in separated form", () => {
    expect(parseCollectionSchedulerCliArgs(["--poll-interval-ms", "250"])).toEqual({
      once: false,
      pollIntervalMs: 250,
    });
  });

  it("parses --poll-interval-ms in inline form", () => {
    expect(parseCollectionSchedulerCliArgs(["--poll-interval-ms=250"])).toEqual({
      once: false,
      pollIntervalMs: 250,
    });
  });

  it("parses --once together with --poll-interval-ms", () => {
    expect(
      parseCollectionSchedulerCliArgs(["--once", "--poll-interval-ms", "100"]),
    ).toEqual({
      once: true,
      pollIntervalMs: 100,
    });
  });

  it("signals help on --help", () => {
    expect(() => parseCollectionSchedulerCliArgs(["--help"])).toThrow(
      CollectionSchedulerCliHelpRequested,
    );
  });

  it("signals help on -h", () => {
    expect(() => parseCollectionSchedulerCliArgs(["-h"])).toThrow(
      CollectionSchedulerCliHelpRequested,
    );
  });

  it("rejects duplicate --once", () => {
    expect(() =>
      parseCollectionSchedulerCliArgs(["--once", "--once"]),
    ).toThrow(CollectionSchedulerCliArgumentError);
  });

  it("rejects duplicate --poll-interval-ms across separated and inline forms", () => {
    expect(() =>
      parseCollectionSchedulerCliArgs([
        "--poll-interval-ms",
        "250",
        "--poll-interval-ms=500",
      ]),
    ).toThrow(CollectionSchedulerCliArgumentError);
    expect(() =>
      parseCollectionSchedulerCliArgs([
        "--poll-interval-ms=250",
        "--poll-interval-ms",
        "500",
      ]),
    ).toThrow(CollectionSchedulerCliArgumentError);
  });

  it("rejects unknown flags", () => {
    expect(() => parseCollectionSchedulerCliArgs(["--bogus"])).toThrow(
      CollectionSchedulerCliArgumentError,
    );
  });

  it("rejects positional arguments", () => {
    expect(() => parseCollectionSchedulerCliArgs(["foo"])).toThrow(
      CollectionSchedulerCliArgumentError,
    );
  });

  it("rejects --poll-interval-ms with no value", () => {
    expect(() =>
      parseCollectionSchedulerCliArgs(["--poll-interval-ms"]),
    ).toThrow(CollectionSchedulerCliArgumentError);
    expect(() =>
      parseCollectionSchedulerCliArgs(["--poll-interval-ms", "--once"]),
    ).toThrow(CollectionSchedulerCliArgumentError);
  });

  it("rejects nonnumeric --poll-interval-ms values", () => {
    expect(() =>
      parseCollectionSchedulerCliArgs(["--poll-interval-ms", "abc"]),
    ).toThrow(CollectionSchedulerCliArgumentError);
  });

  it("rejects fractional --poll-interval-ms values", () => {
    expect(() =>
      parseCollectionSchedulerCliArgs(["--poll-interval-ms", "1.5"]),
    ).toThrow(CollectionSchedulerCliArgumentError);
    expect(() =>
      parseCollectionSchedulerCliArgs(["--poll-interval-ms=1.5"]),
    ).toThrow(CollectionSchedulerCliArgumentError);
  });

  it("rejects zero and negative --poll-interval-ms values", () => {
    expect(() =>
      parseCollectionSchedulerCliArgs(["--poll-interval-ms", "0"]),
    ).toThrow(CollectionSchedulerCliArgumentError);
    expect(() =>
      parseCollectionSchedulerCliArgs(["--poll-interval-ms=-1"]),
    ).toThrow(CollectionSchedulerCliArgumentError);
    expect(() =>
      parseCollectionSchedulerCliArgs(["--poll-interval-ms", "-50"]),
    ).toThrow(CollectionSchedulerCliArgumentError);
  });

  it("rejects empty inline --poll-interval-ms values", () => {
    expect(() =>
      parseCollectionSchedulerCliArgs(["--poll-interval-ms="]),
    ).toThrow(CollectionSchedulerCliArgumentError);
  });

  it("documents usage", () => {
    const usage = getCollectionSchedulerCliUsage();

    expect(usage).toContain("pnpm collector:scheduler:run");
    expect(usage).toContain("--once");
    expect(usage).toContain("--poll-interval-ms");
    expect(usage).toContain("--help");
    expect(usage).toContain("-h");
  });
});