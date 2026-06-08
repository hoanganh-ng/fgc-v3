import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const forbiddenImportPattern =
  /\b(?:from|import)\s*(?:\(\s*)?["'][^"']*(?:interfaces\/http|fastify|collector-runtime|graphql|browser|ui)[^"']*["']/i;

describe("content manager composition boundary", () => {
  it("keeps content manager composition independent from HTTP, parser, runtime, and UI adapters", () => {
    const files = collectTypeScriptFiles(new URL("./", import.meta.url));
    const offendingFiles = files.filter((file) =>
      forbiddenImportPattern.test(readFileSync(file, "utf8")),
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
