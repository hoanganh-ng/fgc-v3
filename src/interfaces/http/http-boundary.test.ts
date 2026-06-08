import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
    ];
    const offendingFiles = files.filter((file) =>
      forbiddenHttpImportPattern.test(readFileSync(file, "utf8")),
    );

    expect(offendingFiles.map((file) => file.pathname)).toEqual([]);
  });
});

function collectTypeScriptFiles(directory: URL): readonly URL[] {
  const files: URL[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryUrl = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      directory,
    );

    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(entryUrl));
      continue;
    }

    if (entry.name.endsWith(".ts")) {
      files.push(entryUrl);
    }
  }

  return files;
}
