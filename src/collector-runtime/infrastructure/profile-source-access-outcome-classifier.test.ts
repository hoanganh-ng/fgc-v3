import { describe, expect, it } from "vitest";
import { DeterministicProfileSourceAccessOutcomeClassifier } from "./profile-source-access-outcome-classifier";
import type { ProfileSourceAccessBrowserObservation } from "../application";

describe("profile-source access outcome classifier", () => {
  it.each([
    [
      "checkpoint evidence",
      observation({ pageKind: "FACEBOOK_CHECKPOINT" }),
      "CHECKPOINT_REQUIRED",
    ],
    ["login evidence", observation({ pageKind: "FACEBOOK_LOGIN" }), "LOGIN_REQUIRED"],
    [
      "unavailable evidence",
      observation({ pageKind: "FACEBOOK_UNAVAILABLE" }),
      "ACCESS_DENIED",
    ],
    [
      "explicit denied evidence",
      observation({ accessDeniedIndicatorVisible: true }),
      "ACCESS_DENIED",
    ],
    [
      "joined group content",
      observation({ groupContentVisible: true, joinedIndicatorVisible: true }),
      "JOINED_ACCESSIBLE",
    ],
    [
      "joined accessible private group content",
      observation({ groupContentVisible: true, joinedIndicatorVisible: true }),
      "JOINED_ACCESSIBLE",
    ],
    [
      "join action",
      observation({ groupContentVisible: true, joinActionVisible: true }),
      "JOIN_REQUIRED",
    ],
    [
      "public group content",
      observation({ groupContentVisible: true }),
      "PUBLIC_ACCESSIBLE",
    ],
    ["ambiguous evidence", observation({ pageKind: "OTHER" }), "NEEDS_MANUAL_REVIEW"],
  ] as const)("classifies %s", async (_name, input, expected) => {
    await expect(
      new DeterministicProfileSourceAccessOutcomeClassifier().classify(input),
    ).resolves.toBe(expected);
  });

  it.each([
    [
      "join and joined evidence",
      observation({
        groupContentVisible: true,
        joinActionVisible: true,
        joinedIndicatorVisible: true,
      }),
    ],
    [
      "joined and denied evidence",
      observation({
        groupContentVisible: true,
        joinedIndicatorVisible: true,
        accessDeniedIndicatorVisible: true,
      }),
    ],
    [
      "visible group content and unavailable evidence",
      observation({
        pageKind: "FACEBOOK_UNAVAILABLE",
        groupContentVisible: true,
      }),
    ],
  ] as const)("routes contradictory %s to manual review", async (_name, input) => {
    await expect(
      new DeterministicProfileSourceAccessOutcomeClassifier().classify(input),
    ).resolves.toBe("NEEDS_MANUAL_REVIEW");
  });
});

function observation(
  overrides: Partial<ProfileSourceAccessBrowserObservation>,
): ProfileSourceAccessBrowserObservation {
  return {
    pageKind: "FACEBOOK_GROUP",
    groupContentVisible: false,
    joinActionVisible: false,
    joinedIndicatorVisible: false,
    accessDeniedIndicatorVisible: false,
    ...overrides,
  };
}
