import { describe, expect, it } from "vitest";
import {
  extractDatabaseName,
  isAcceptedIsolatedDatabaseName,
  resolveIsolatedSprint064BDatabaseUrl,
  Sprint064BIsolatedDatabaseGuardError,
} from "./sprint-064b-isolated-database.guard";

describe("extractDatabaseName (Sprint 064B guard)", () => {
  it("returns the database name for a standard postgres URL", () => {
    expect(
      extractDatabaseName(
        "postgres://user:secret@host:5432/sprint_064b_isolated",
      ),
    ).toBe("sprint_064b_isolated");
  });

  it("returns the database name for a postgresql URL", () => {
    expect(
      extractDatabaseName("postgresql://host/sprint_064b_temp_db"),
    ).toBe("sprint_064b_temp_db");
  });

  it("returns null for unparseable input", () => {
    expect(extractDatabaseName("not a url")).toBeNull();
  });

  it("returns null for non-postgres schemes", () => {
    expect(extractDatabaseName("mysql://host/db")).toBeNull();
  });

  it("returns null when the URL has no database name", () => {
    expect(extractDatabaseName("postgres://host/")).toBeNull();
  });
});

describe("isAcceptedIsolatedDatabaseName (Sprint 064B guard)", () => {
  it("accepts sprint_064b_isolated", () => {
    expect(isAcceptedIsolatedDatabaseName("sprint_064b_isolated")).toBe(true);
  });

  it("accepts disposable names beginning with sprint_064b_", () => {
    expect(isAcceptedIsolatedDatabaseName("sprint_064b_temp_01")).toBe(true);
  });

  it("rejects content_pipeline", () => {
    expect(isAcceptedIsolatedDatabaseName("content_pipeline")).toBe(false);
  });

  it("rejects postgres", () => {
    expect(isAcceptedIsolatedDatabaseName("postgres")).toBe(false);
  });

  it("rejects unrelated names", () => {
    expect(isAcceptedIsolatedDatabaseName("myapp_dev")).toBe(false);
  });

  it("rejects names that merely contain the prefix", () => {
    expect(isAcceptedIsolatedDatabaseName("not_sprint_064b_isolated")).toBe(
      false,
    );
  });
});

describe("resolveIsolatedSprint064BDatabaseUrl (Sprint 064B guard)", () => {
  it("rejects when SPRINT_064B_DATABASE_URL is missing", () => {
    expect(() =>
      resolveIsolatedSprint064BDatabaseUrl({ env: {} }),
    ).toThrow(Sprint064BIsolatedDatabaseGuardError);
  });

  it("rejects when SPRINT_064B_DATABASE_URL is an empty string", () => {
    expect(() =>
      resolveIsolatedSprint064BDatabaseUrl({
        env: { SPRINT_064B_DATABASE_URL: "" },
      }),
    ).toThrow(Sprint064BIsolatedDatabaseGuardError);
  });

  it("rejects when SPRINT_064B_DATABASE_URL targets the shared content_pipeline database", () => {
    expect(() =>
      resolveIsolatedSprint064BDatabaseUrl({
        env: {
          SPRINT_064B_DATABASE_URL:
            "postgres://user:secret@host:5432/content_pipeline",
        },
      }),
    ).toThrow(Sprint064BIsolatedDatabaseGuardError);
  });

  it("rejects when SPRINT_064B_DATABASE_URL targets the default postgres database", () => {
    expect(() =>
      resolveIsolatedSprint064BDatabaseUrl({
        env: {
          SPRINT_064B_DATABASE_URL: "postgres://user:secret@host:5432/postgres",
        },
      }),
    ).toThrow(Sprint064BIsolatedDatabaseGuardError);
  });

  it("rejects when the database name is not sprint_064b-scoped", () => {
    expect(() =>
      resolveIsolatedSprint064BDatabaseUrl({
        env: {
          SPRINT_064B_DATABASE_URL: "postgres://user:secret@host:5432/myapp_dev",
        },
      }),
    ).toThrow(Sprint064BIsolatedDatabaseGuardError);
  });

  it("rejects when the URL is unparseable", () => {
    expect(() =>
      resolveIsolatedSprint064BDatabaseUrl({
        env: { SPRINT_064B_DATABASE_URL: "not a url" },
      }),
    ).toThrow(Sprint064BIsolatedDatabaseGuardError);
  });

  it("accepts sprint_064b_isolated and returns the URL", () => {
    const url = "postgres://user:secret@host:5432/sprint_064b_isolated";
    expect(
      resolveIsolatedSprint064BDatabaseUrl({
        env: { SPRINT_064B_DATABASE_URL: url },
      }),
    ).toBe(url);
  });

  it("accepts disposable names beginning with sprint_064b_", () => {
    const url = "postgres://user:secret@host:5432/sprint_064b_temp_run";
    expect(
      resolveIsolatedSprint064BDatabaseUrl({
        env: { SPRINT_064B_DATABASE_URL: url },
      }),
    ).toBe(url);
  });

  it("never includes credentials in error messages", () => {
    let caught: unknown;
    try {
      resolveIsolatedSprint064BDatabaseUrl({
        env: { SPRINT_064B_DATABASE_URL: "postgres://user:secret@host/db" },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Sprint064BIsolatedDatabaseGuardError);
    const message = (caught as Error).message;
    expect(message).not.toContain("user:secret");
    expect(message).not.toContain("secret");
    expect(message).not.toContain("postgres://user:secret@host/db");
  });

  it("never echoes the full connection URL in missing-variable errors", () => {
    try {
      resolveIsolatedSprint064BDatabaseUrl({
        env: {
          SPRINT_064B_DATABASE_URL:
            "postgres://app:topsecret@db.internal:6543/sprint_064b_isolated",
        },
      });
    } catch (_error) {
      // expected; intentionally unused
    }

    let caught: unknown;
    try {
      resolveIsolatedSprint064BDatabaseUrl({ env: {} });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Sprint064BIsolatedDatabaseGuardError);
    expect((caught as Error).message).not.toContain("topsecret");
    expect((caught as Error).message).not.toContain("db.internal");
  });
});