import { describe, expect, it } from "vitest";
import {
  MissingCompositionConfigError,
  loadCompositionConfig,
} from "./config";

describe("composition config", () => {
  it("fails clearly when DATABASE_URL is missing", () => {
    expect(() => loadCompositionConfig({})).toThrow(
      MissingCompositionConfigError,
    );
    expect(() => loadCompositionConfig({ DATABASE_URL: " " })).toThrow(
      "DATABASE_URL is required for application composition.",
    );
  });

  it("accepts a valid DATABASE_URL", () => {
    expect(
      loadCompositionConfig({
        DATABASE_URL: " postgres://user:pass@localhost:5432/content_pipeline ",
      }),
    ).toEqual({
      databaseUrl: "postgres://user:pass@localhost:5432/content_pipeline",
    });
  });
});
