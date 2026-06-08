import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const forbiddenRepositoryOrDatabaseImportPattern =
  /\b(?:from|import)\s*(?:\(\s*)?["'][^"']*(?:infrastructure\/database|drizzle|postgres|repositories\/|profile-repository|profile-lease-repository|content-item-repository|source-group-repository|content-category-repository)[^"']*["']/i;
const forbiddenBrowserAutomationImportPattern =
  /\b(?:from|import)\s*(?:\(\s*)?["'][^"']*(?:playwright|puppeteer|selenium|browserless)[^"']*["']/i;

describe("collector runtime architecture boundary", () => {
  it("keeps collector runtime free of direct database and repository imports", () => {
    const offendingFiles = collectTypeScriptFiles(
      new URL("./", import.meta.url),
    ).filter((file) =>
      forbiddenRepositoryOrDatabaseImportPattern.test(readFileSync(file, "utf8")),
    );

    expect(offendingFiles.map((file) => file.pathname)).toEqual([]);
  });

  it("keeps collector runtime free of browser automation imports", () => {
    const offendingFiles = collectTypeScriptFiles(
      new URL("./", import.meta.url),
    ).filter((file) =>
      forbiddenBrowserAutomationImportPattern.test(readFileSync(file, "utf8")),
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
