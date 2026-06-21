import { describe, expect, it } from "vitest";
import {
  extractDatabaseName,
  isAcceptedIsolatedDatabaseName,
  resolveIsolatedSprint068B1DatabaseUrl,
  Sprint068B1IsolatedDatabaseGuardError,
} from "./sprint-068b1-isolated-database.guard";

describe("Sprint 068B1 isolated database guard", () => {
  describe("extractDatabaseName", () => {
    it("returns the database name from a standard postgres URL", () => {
      expect(
        extractDatabaseName(
          "postgres://content_pipeline:secret@localhost:5432/sprint_068b1_isolated",
        ),
      ).toBe("sprint_068b1_isolated");
    });

    it("returns null for non-postgres URLs", () => {
      expect(extractDatabaseName("mysql://localhost/x")).toBeNull();
    });

    it("returns null for unparseable URLs", () => {
      expect(extractDatabaseName("not a url")).toBeNull();
    });
  });

  describe("isAcceptedIsolatedDatabaseName", () => {
    it("accepts the canonical isolated name", () => {
      expect(isAcceptedIsolatedDatabaseName("sprint_068b1_isolated")).toBe(
        true,
      );
    });

    it("accepts disposable names with the sprint_068b1_ prefix", () => {
      expect(isAcceptedIsolatedDatabaseName("sprint_068b1_extra")).toBe(true);
    });

    it("rejects unrelated database names", () => {
      expect(isAcceptedIsolatedDatabaseName("content_pipeline")).toBe(false);
      expect(isAcceptedIsolatedDatabaseName("sprint_058_isolated")).toBe(false);
    });
  });

  describe("resolveIsolatedSprint068B1DatabaseUrl", () => {
    it("returns the URL when pointing at the canonical isolated database", () => {
      const url = "postgres://u:p@localhost:5432/sprint_068b1_isolated";
      expect(
        resolveIsolatedSprint068B1DatabaseUrl({
          env: { SPRINT_068B1_DATABASE_URL: url },
        }),
      ).toBe(url);
    });

    it("throws when the env var is missing", () => {
      expect(() =>
        resolveIsolatedSprint068B1DatabaseUrl({ env: {} }),
      ).toThrow(Sprint068B1IsolatedDatabaseGuardError);
    });

    it("throws when the env var is empty", () => {
      expect(() =>
        resolveIsolatedSprint068B1DatabaseUrl({
          env: { SPRINT_068B1_DATABASE_URL: "  " },
        }),
      ).toThrow(Sprint068B1IsolatedDatabaseGuardError);
    });

    it("throws when the URL targets the shared content_pipeline database", () => {
      expect(() =>
        resolveIsolatedSprint068B1DatabaseUrl({
          env: {
            SPRINT_068B1_DATABASE_URL:
              "postgres://u:p@localhost:5432/content_pipeline",
          },
        }),
      ).toThrow(Sprint068B1IsolatedDatabaseGuardError);
    });

    it("throws when the database name is not a Sprint 068B1 isolated name", () => {
      expect(() =>
        resolveIsolatedSprint068B1DatabaseUrl({
          env: {
            SPRINT_068B1_DATABASE_URL: "postgres://u:p@localhost:5432/other",
          },
        }),
      ).toThrow(Sprint068B1IsolatedDatabaseGuardError);
    });
  });
});
