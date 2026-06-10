import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseFacebookJson,
  sanitizeFacebookDiagnosticUrl,
  shouldCaptureFacebookPayload,
  shouldCaptureFacebookGraphQLResponse,
} from "./facebook-browser-payload-capture";

describe("shouldCaptureFacebookPayload", () => {
  it("matches Facebook GraphQL, ajax, and JSON responses", () => {
    expect(
      shouldCaptureFacebookPayload(
        "https://www.facebook.com/api/graphql/",
        "text/html",
      ),
    ).toBe(true);
    expect(
      shouldCaptureFacebookPayload(
        "https://www.facebook.com/graphql/?doc_id=1",
        undefined,
      ),
    ).toBe(true);
    expect(
      shouldCaptureFacebookPayload(
        "https://www.facebook.com/ajax/pagelet/generic.php",
        undefined,
      ),
    ).toBe(true);
    expect(
      shouldCaptureFacebookPayload(
        "https://www.facebook.com/groups/group-1/",
        "application/json; charset=utf-8",
      ),
    ).toBe(true);
  });

  it("ignores non-matching non-JSON responses", () => {
    expect(
      shouldCaptureFacebookPayload(
        "https://www.facebook.com/groups/group-1/",
        "text/html; charset=utf-8",
      ),
    ).toBe(false);
  });

  it("keeps the response metadata wrapper behavior", () => {
    expect(
      shouldCaptureFacebookGraphQLResponse({
        url: "https://www.facebook.com/api/graphql/",
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      }),
    ).toBe(true);
    expect(
      shouldCaptureFacebookGraphQLResponse({
        url: "https://www.facebook.com/api/graphql/?doc_id=1",
      }),
    ).toBe(true);
  });
});

describe("parseFacebookJson", () => {
  it("parses normal JSON bodies", () => {
    expect(parseFacebookJson('{"data":{"post":"post-1"}}')).toEqual({
      bodies: [
        {
          data: {
            post: "post-1",
          },
        },
      ],
      parseFailed: false,
    });
  });

  it("strips Facebook for-prefixes before parsing", () => {
    expect(parseFacebookJson('for (;;);{"data":{"post":"post-1"}}')).toEqual({
      bodies: [
        {
          data: {
            post: "post-1",
          },
        },
      ],
      parseFailed: false,
    });
  });

  it("parses newline-separated JSON records and ignores bad records", () => {
    expect(
      parseFacebookJson(
        [
          'for (;;);{"data":{"post":"post-1"}}',
          "",
          "not-json",
          '{"data":{"post":"post-2"}}',
        ].join("\n"),
      ),
    ).toEqual({
      bodies: [
        {
          data: {
            post: "post-1",
          },
        },
        {
          data: {
            post: "post-2",
          },
        },
      ],
      parseFailed: false,
    });
  });

  it("reports parse failure without returning raw body text", () => {
    const result = parseFacebookJson("not-json-with-session-cookie-value");

    expect(result).toEqual({
      bodies: [],
      parseFailed: true,
    });
    expect(JSON.stringify(result)).not.toContain("session-cookie-value");
  });
});

describe("sanitizeFacebookDiagnosticUrl", () => {
  it("keeps only safe URL path diagnostics", () => {
    expect(
      sanitizeFacebookDiagnosticUrl(
        "https://www.facebook.com/groups/group-1?fbclid=session-token#feed",
      ),
    ).toBe("https://www.facebook.com/groups/group-1");
  });

  it("does not echo invalid URL diagnostics", () => {
    expect(
      sanitizeFacebookDiagnosticUrl("not a url with session-cookie-value"),
    ).toBeUndefined();
  });

  it("does not introduce raw payload persistence", () => {
    const source = readFileSync(
      new URL("./facebook-browser-payload-capture.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(/\bwriteFile|createWriteStream|appendFile\b/);
  });
});
