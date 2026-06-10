import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  shouldCaptureFacebookGraphQLResponse,
} from "./facebook-browser-payload-capture";

describe("shouldCaptureFacebookGraphQLResponse", () => {
  it("matches Facebook GraphQL JSON responses", () => {
    expect(
      shouldCaptureFacebookGraphQLResponse({
        url: "https://www.facebook.com/api/graphql/",
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      }),
    ).toBe(true);
  });

  it("attempts likely GraphQL responses when content-type is absent", () => {
    expect(
      shouldCaptureFacebookGraphQLResponse({
        url: "https://www.facebook.com/api/graphql/?doc_id=1",
      }),
    ).toBe(true);
  });

  it("ignores non-GraphQL or clearly non-JSON responses", () => {
    expect(
      shouldCaptureFacebookGraphQLResponse({
        url: "https://www.facebook.com/groups/group-1/",
        headers: {
          "content-type": "application/json",
        },
      }),
    ).toBe(false);
    expect(
      shouldCaptureFacebookGraphQLResponse({
        url: "https://www.facebook.com/api/graphql/",
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      }),
    ).toBe(false);
  });

  it("does not introduce raw payload persistence", () => {
    const source = readFileSync(
      new URL("./facebook-browser-payload-capture.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(/\bwriteFile|createWriteStream|appendFile\b/);
  });
});
