import { describe, expect, it } from "vitest";
import {
  AssistedGroupAccessCliArgumentError,
  DEFAULT_ASSISTED_GROUP_ACCESS_MAX_DURATION_MS,
  getAssistedGroupAccessCliUsage,
  parseAssistedGroupAccessCliArgs,
} from "./cli-args";

describe("assisted group access CLI args", () => {
  it("parses required and optional arguments", () => {
    expect(
      parseAssistedGroupAccessCliArgs([
        "--profile-id",
        " profile-1 ",
        "--source-group-id=source-group-1",
        "--base-url",
        "http://localhost:8081",
        "--entry-route-id",
        "route-1",
        "--browser-provider",
        "cloakbrowser",
        "--max-duration-ms",
        "30000",
        "--allow-high-risk-route",
      ]),
    ).toEqual({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      baseUrl: "http://localhost:8081",
      entryRouteId: "route-1",
      browserProvider: "cloakbrowser",
      maxDurationMs: 30_000,
      allowHighRiskRoute: true,
    });
  });

  it("defaults browser provider and max duration", () => {
    expect(
      parseAssistedGroupAccessCliArgs([
        "--profile-id",
        "profile-1",
        "--source-group-id",
        "source-group-1",
        "--base-url",
        "https://api.test",
      ]),
    ).toMatchObject({
      browserProvider: "playwright",
      maxDurationMs: DEFAULT_ASSISTED_GROUP_ACCESS_MAX_DURATION_MS,
      allowHighRiskRoute: false,
    });
  });

  it("requires profile, source group, and base URL", () => {
    expect(() => parseAssistedGroupAccessCliArgs([])).toThrow(
      AssistedGroupAccessCliArgumentError,
    );
    expect(() =>
      parseAssistedGroupAccessCliArgs([
        "--profile-id",
        "profile-1",
        "--source-group-id",
        "source-group-1",
      ]),
    ).toThrow("--base-url is required.");
  });

  it("validates max duration range", () => {
    for (const value of ["29999", "1800001", "1.5"]) {
      expect(() =>
        parseAssistedGroupAccessCliArgs([
          "--profile-id",
          "profile-1",
          "--source-group-id",
          "source-group-1",
          "--base-url",
          "http://localhost:8081",
          "--max-duration-ms",
          value,
        ]),
      ).toThrow(AssistedGroupAccessCliArgumentError);
    }
  });

  it("shows canonical command and compatibility alias context in usage", () => {
    const usage = getAssistedGroupAccessCliUsage();

    expect(usage).toContain("pnpm operator:profile:assisted-access");
    expect(usage).toContain("--allow-high-risk-route");
  });
});
