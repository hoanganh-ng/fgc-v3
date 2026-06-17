import { describe, expect, it } from "vitest";
import {
  extractDatabaseName,
  isAcceptedIsolatedDatabaseName,
  resolveIsolatedSprint058DatabaseUrl,
  Sprint058IsolatedDatabaseGuardError,
} from "./sprint-058-isolated-database.guard";

describe("extractDatabaseName", () => {
  it("returns the database name for a standard postgres URL", () => {
    expect(
      extractDatabaseName("postgres://user:secret@host:5432/sprint_058_isolated"),
    ).toBe("sprint_058_isolated");
  });

  it("returns the database name for a postgresql URL", () => {
    expect(
      extractDatabaseName("postgresql://host/sprint_058_temp_db"),
    ).toBe("sprint_058_temp_db");
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

describe("isAcceptedIsolatedDatabaseName", () => {
  it("accepts sprint_058_isolated", () => {
    expect(isAcceptedIsolatedDatabaseName("sprint_058_isolated")).toBe(true);
  });

  it("accepts disposable names beginning with sprint_058_", () => {
    expect(isAcceptedIsolatedDatabaseName("sprint_058_temp_01")).toBe(true);
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
    expect(isAcceptedIsolatedDatabaseName("not_sprint_058_isolated")).toBe(false);
  });
});

describe("resolveIsolatedSprint058DatabaseUrl", () => {
  it("rejects when SPRINT_058_DATABASE_URL is missing", () => {
    expect(() =>
      resolveIsolatedSprint058DatabaseUrl({ env: {} }),
    ).toThrow(Sprint058IsolatedDatabaseGuardError);
  });

  it("rejects when SPRINT_058_DATABASE_URL is an empty string", () => {
    expect(() =>
      resolveIsolatedSprint058DatabaseUrl({
        env: { SPRINT_058_DATABASE_URL: "" },
      }),
    ).toThrow(Sprint058IsolatedDatabaseGuardError);
  });

  it("rejects when SPRINT_058_DATABASE_URL targets the shared content_pipeline database", () => {
    expect(() =>
      resolveIsolatedSprint058DatabaseUrl({
        env: {
          SPRINT_058_DATABASE_URL:
            "postgres://user:secret@host:5432/content_pipeline",
        },
      }),
    ).toThrow(Sprint058IsolatedDatabaseGuardError);
  });

  it("rejects when SPRINT_058_DATABASE_URL targets the default postgres database", () => {
    expect(() =>
      resolveIsolatedSprint058DatabaseUrl({
        env: {
          SPRINT_058_DATABASE_URL: "postgres://user:secret@host:5432/postgres",
        },
      }),
    ).toThrow(Sprint058IsolatedDatabaseGuardError);
  });

  it("rejects when the database name is not sprint_058-scoped", () => {
    expect(() =>
      resolveIsolatedSprint058DatabaseUrl({
        env: {
          SPRINT_058_DATABASE_URL: "postgres://user:secret@host:5432/myapp_dev",
        },
      }),
    ).toThrow(Sprint058IsolatedDatabaseGuardError);
  });

  it("rejects when the URL is unparseable", () => {
    expect(() =>
      resolveIsolatedSprint058DatabaseUrl({
        env: { SPRINT_058_DATABASE_URL: "not a url" },
      }),
    ).toThrow(Sprint058IsolatedDatabaseGuardError);
  });

  it("accepts sprint_058_isolated and returns the URL", () => {
    const url = "postgres://user:secret@host:5432/sprint_058_isolated";
    expect(
      resolveIsolatedSprint058DatabaseUrl({
        env: { SPRINT_058_DATABASE_URL: url },
      }),
    ).toBe(url);
  });

  it("accepts disposable names beginning with sprint_058_", () => {
    const url = "postgres://user:secret@host:5432/sprint_058_temp_run";
    expect(
      resolveIsolatedSprint058DatabaseUrl({
        env: { SPRINT_058_DATABASE_URL: url },
      }),
    ).toBe(url);
  });

  it("never includes credentials in error messages", () => {
    let caught: unknown;
    try {
      resolveIsolatedSprint058DatabaseUrl({
        env: { SPRINT_058_DATABASE_URL: "postgres://user:secret@host/db" },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Sprint058IsolatedDatabaseGuardError);
    const message = (caught as Error).message;
    expect(message).not.toContain("user:secret");
    expect(message).not.toContain("secret");
    expect(message).not.toContain("postgres://user:secret@host/db");
  });

  it("never echoes the full connection URL in missing-variable errors", () => {
    let caught: unknown;
    try {
      resolveIsolatedSprint058DatabaseUrl({
        env: {
          SPRINT_058_DATABASE_URL:
            "postgres://app:topsecret@db.internal:6543/sprint_058_isolated",
        },
      });
    } catch (_error) {
      // expected; intentionally unused
    }

    try {
      resolveIsolatedSprint058DatabaseUrl({ env: {} });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Sprint058IsolatedDatabaseGuardError);
    expect((caught as Error).message).not.toContain("topsecret");
    expect((caught as Error).message).not.toContain("db.internal");
  });
});
