import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectTypeScriptFiles } from "../../test-support/collect-typescript-files";

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
