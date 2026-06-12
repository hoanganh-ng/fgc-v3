import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_EXERCISE_BASE_URL,
  DEFAULT_PROFILE_EXERCISE_MAX_DURATION_MS,
  DEFAULT_PROFILE_EXERCISE_MAX_SCROLLS,
  DEFAULT_PROFILE_EXERCISE_MIN_DWELL_MS,
  ProfileExerciseCliArgumentError,
  ProfileExerciseCliHelpRequested,
  getProfileExerciseCliUsage,
  parseProfileExerciseCliArgs,
} from "./cli-args";

describe("profile exercise CLI args", () => {
  it("parses the required profile id and defaults", () => {
    expect(parseProfileExerciseCliArgs(["--profile-id", "profile-1"])).toEqual({
      profileId: "profile-1",
      baseUrl: DEFAULT_PROFILE_EXERCISE_BASE_URL,
      maxDurationMs: DEFAULT_PROFILE_EXERCISE_MAX_DURATION_MS,
      maxScrolls: DEFAULT_PROFILE_EXERCISE_MAX_SCROLLS,
      minDwellMs: DEFAULT_PROFILE_EXERCISE_MIN_DWELL_MS,
      browserProvider: "playwright",
    });
  });

  it("parses forwarded pnpm separator, inline options, and environment defaults", () => {
    expect(
      parseProfileExerciseCliArgs(
        [
          "--",
          "--profile-id=profile-1",
          "--max-duration-ms=60000",
          "--max-scrolls=1",
          "--min-dwell-ms=0",
        ],
        {
          PROFILE_EXERCISE_BASE_URL: "http://localhost:8081",
          BROWSER_PROVIDER: "cloakbrowser",
        },
      ),
    ).toEqual({
      profileId: "profile-1",
      baseUrl: "http://localhost:8081",
      maxDurationMs: 60_000,
      maxScrolls: 1,
      minDwellMs: 0,
      browserProvider: "cloakbrowser",
    });
  });

  it("rejects invalid inputs before browser launch", () => {
    expect(() => parseProfileExerciseCliArgs([])).toThrow(
      ProfileExerciseCliArgumentError,
    );
    expect(() =>
      parseProfileExerciseCliArgs([
        "--profile-id",
        "profile-1",
        "--base-url",
        "ftp://example.test",
      ]),
    ).toThrow(ProfileExerciseCliArgumentError);
    expect(() =>
      parseProfileExerciseCliArgs([
        "--profile-id",
        "profile-1",
        "--max-scrolls",
        "-1",
      ]),
    ).toThrow(ProfileExerciseCliArgumentError);
  });

  it("prints help", () => {
    expect(() => parseProfileExerciseCliArgs(["--help"])).toThrow(
      ProfileExerciseCliHelpRequested,
    );
    expect(getProfileExerciseCliUsage()).toContain(
      "pnpm operator:profile:exercise",
    );
  });
});
