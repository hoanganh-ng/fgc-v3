import { describe, expect, it } from "vitest";
import {
  RequestProfileSourceAccessCheckRunFormSchema,
  getOutcomePresentation,
  getProfileDisplay,
  getSourceGroupDisplay,
  hasActiveProfileSourceAccessCheckRuns,
  isCheckRunFiltersActive,
  canCancelProfileSourceAccessCheckRun,
  getPaginationModel,
  shouldShowPaginationControls,
} from "./profile-source-access-check-run-view-model";

describe("profile-source-access-check-run view model", () => {
  describe("RequestProfileSourceAccessCheckRunFormSchema", () => {
    it("validates valid inputs", () => {
      const parsed = RequestProfileSourceAccessCheckRunFormSchema.safeParse({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      });
      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      });
    });

    it("rejects empty strings and whitespace-only strings", () => {
      const parsed = RequestProfileSourceAccessCheckRunFormSchema.safeParse({
        profileId: " ",
        sourceGroupId: "",
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects extra fields", () => {
      const parsed = RequestProfileSourceAccessCheckRunFormSchema.safeParse({
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
        extra: "field",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("getOutcomePresentation", () => {
    it("returns correct labels and tones for all outcomes", () => {
      expect(getOutcomePresentation("PUBLIC_ACCESSIBLE")).toEqual({
        label: "Public Accessible",
        tone: "success",
      });
      expect(getOutcomePresentation("JOIN_REQUIRED")).toEqual({
        label: "Join Required",
        tone: "warning",
      });
      expect(getOutcomePresentation("JOINED_ACCESSIBLE")).toEqual({
        label: "Joined Accessible",
        tone: "success",
      });
      expect(getOutcomePresentation("ACCESS_DENIED")).toEqual({
        label: "Access Denied",
        tone: "danger",
      });
      expect(getOutcomePresentation("LOGIN_REQUIRED")).toEqual({
        label: "Login Required",
        tone: "danger",
      });
      expect(getOutcomePresentation("CHECKPOINT_REQUIRED")).toEqual({
        label: "Checkpoint Required",
        tone: "danger",
      });
      expect(getOutcomePresentation("NEEDS_MANUAL_REVIEW")).toEqual({
        label: "Needs Manual Review",
        tone: "warning",
      });
    });
  });

  describe("getProfileDisplay", () => {
    it("displays profile displayName when found", () => {
      const profiles = new Map([
        [
          "profile-1",
          { id: "profile-1", displayName: "Active Profile", status: "READY", accountStage: "WARMING" },
        ],
      ]);
      expect(getProfileDisplay("profile-1", profiles)).toEqual({
        primary: "Active Profile",
        secondary: "profile-1 / READY / WARMING",
        found: true,
      });
    });

    it("falls back gracefully when profile not found", () => {
      const profiles = new Map();
      expect(getProfileDisplay("profile-1", profiles)).toEqual({
        primary: "profile-1",
        secondary: "Profile details unavailable",
        found: false,
      });
    });
  });

  describe("getSourceGroupDisplay", () => {
    it("displays source group displayName when found", () => {
      const sourceGroups = new Map([
        [
          "source-group-1",
          { id: "source-group-1", name: "Source Group A", platform: "FACEBOOK", status: "ACTIVE" },
        ],
      ]);
      expect(getSourceGroupDisplay("source-group-1", sourceGroups)).toEqual({
        primary: "Source Group A",
        secondary: "FACEBOOK / ACTIVE",
        found: true,
      });
    });

    it("falls back gracefully when source group not found", () => {
      const sourceGroups = new Map();
      expect(getSourceGroupDisplay("source-group-1", sourceGroups)).toEqual({
        primary: "source-group-1",
        secondary: "Source group details unavailable",
        found: false,
      });
    });
  });

  describe("hasActiveProfileSourceAccessCheckRuns", () => {
    it("returns true if any run is QUEUED or RUNNING", () => {
      expect(hasActiveProfileSourceAccessCheckRuns([{ status: "QUEUED" }])).toBe(true);
      expect(hasActiveProfileSourceAccessCheckRuns([{ status: "RUNNING" }])).toBe(true);
      expect(hasActiveProfileSourceAccessCheckRuns([{ status: "SUCCEEDED" }])).toBe(false);
      expect(hasActiveProfileSourceAccessCheckRuns([{ status: "FAILED" }])).toBe(false);
      expect(hasActiveProfileSourceAccessCheckRuns([{ status: "CANCELED" }])).toBe(false);
    });
  });

  describe("canCancelProfileSourceAccessCheckRun", () => {
    it("returns true only for QUEUED runs", () => {
      expect(canCancelProfileSourceAccessCheckRun("QUEUED")).toBe(true);
      expect(canCancelProfileSourceAccessCheckRun("RUNNING")).toBe(false);
      expect(canCancelProfileSourceAccessCheckRun("SUCCEEDED")).toBe(false);
      expect(canCancelProfileSourceAccessCheckRun("FAILED")).toBe(false);
      expect(canCancelProfileSourceAccessCheckRun("CANCELED")).toBe(false);
    });
  });

  describe("getPaginationModel", () => {
    it("computes previous/next page eligibility", () => {
      expect(getPaginationModel({ offset: 0, limit: 10, itemCount: 10, total: 15 })).toEqual({
        canGoBack: false,
        canGoNext: true,
        visibleRange: { start: 1, end: 10 },
      });

      expect(getPaginationModel({ offset: 10, limit: 10, itemCount: 5, total: 15 })).toEqual({
        canGoBack: true,
        canGoNext: false,
        visibleRange: { start: 11, end: 15 },
      });
    });
  });

  describe("shouldShowPaginationControls", () => {
    it("determines when to show controls", () => {
      expect(shouldShowPaginationControls({ offset: 0, limit: 10, itemCount: 10, total: 10 })).toBe(true);
      expect(shouldShowPaginationControls({ offset: 0, limit: 10, itemCount: 0, total: 0 })).toBe(false);
    });
  });

  describe("isCheckRunFiltersActive", () => {
    it("returns false when all filters are empty", () => {
      expect(isCheckRunFiltersActive({ status: "", profileId: "", sourceGroupId: "" })).toBe(false);
    });

    it("returns false when all filters are whitespace only", () => {
      expect(isCheckRunFiltersActive({ status: "  ", profileId: "  ", sourceGroupId: "  " })).toBe(false);
    });

    it("returns true when status is set", () => {
      expect(isCheckRunFiltersActive({ status: "QUEUED", profileId: "", sourceGroupId: "" })).toBe(true);
    });

    it("returns true when profileId is set", () => {
      expect(isCheckRunFiltersActive({ status: "", profileId: "profile-1", sourceGroupId: "" })).toBe(true);
    });

    it("returns true when sourceGroupId is set", () => {
      expect(isCheckRunFiltersActive({ status: "", profileId: "", sourceGroupId: "sg-1" })).toBe(true);
    });

    it("returns true when multiple filters are set", () => {
      expect(
        isCheckRunFiltersActive({ status: "SUCCEEDED", profileId: "profile-1", sourceGroupId: "sg-1" }),
      ).toBe(true);
    });
  });
});
