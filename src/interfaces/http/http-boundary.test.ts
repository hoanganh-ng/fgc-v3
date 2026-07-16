import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectTypeScriptFiles } from "../../test-support/collect-typescript-files";

const forbiddenHttpImportPattern =
  /\b(?:from|import)\s*(?:\(\s*)?["'](?:fastify|[^"']*(?:interfaces\/http|\/http\/)[^"']*)["']/;

describe("HTTP adapter architecture boundary", () => {
  it("keeps domain and application code independent from Fastify and HTTP adapters", () => {
    const files = [
      ...collectTypeScriptFiles(
        new URL("../../collector-profile-manager/domain/", import.meta.url),
      ),
      ...collectTypeScriptFiles(
        new URL("../../collector-profile-manager/application/", import.meta.url),
      ),
      ...collectTypeScriptFiles(
        new URL("../../content-manager/domain/", import.meta.url),
      ),
      ...collectTypeScriptFiles(
        new URL("../../content-manager/application/", import.meta.url),
      ),
      ...collectTypeScriptFiles(
        new URL("../../content-builder/domain/", import.meta.url),
      ),
      ...collectTypeScriptFiles(
        new URL("../../content-builder/application/", import.meta.url),
      ),
      ...collectTypeScriptFiles(
        new URL("../../collector-runtime/domain/", import.meta.url),
      ),
      ...collectTypeScriptFiles(
        new URL("../../collector-runtime/application/", import.meta.url),
      ),
    ];
    const offendingFiles = files.filter((file) =>
      forbiddenHttpImportPattern.test(readFileSync(file, "utf8")),
    );

    expect(offendingFiles.map((file) => file.pathname)).toEqual([]);
  });
});
