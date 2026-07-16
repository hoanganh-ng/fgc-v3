import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collectRelativeModuleGraph,
  findModuleGraphCycle,
  referencesCompatibilityBarrel,
} from "../../../src/test-support/collect-typescript-module-graph";

const webRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const repoRoot = resolve(webRoot, "../..");

const forbiddenBackendImportPattern =
  /\b(?:from|import)\s*(?:\(\s*)?["'](?:\.\.\/){2,}src\/|["'][^"']*\/fgc-v3\/src\/[^"']*["']/;

const webCompatibilityBarrel =
  "apps/web/src/lib/api/collector-runtime-client.ts";

function collectWebTypeScriptFiles(directory: URL): readonly URL[] {
  const files: URL[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryUrl = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      directory,
    );

    if (entry.isDirectory()) {
      files.push(...collectWebTypeScriptFiles(entryUrl));
      continue;
    }

    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(entryUrl);
    }
  }

  return files;
}

describe("web architecture boundary", () => {
  it("keeps the Web application from importing backend src modules", () => {
    const files = collectWebTypeScriptFiles(pathToFileURL(`${webRoot}/src/`)).filter(
      (file) =>
        !file.pathname.endsWith(".test.ts") &&
        !file.pathname.endsWith(".test.tsx"),
    );
    const offendingFiles = files.filter((file) =>
      forbiddenBackendImportPattern.test(readFileSync(file, "utf8")),
    );

    expect(offendingFiles.map((file) => relative(repoRoot, fileURLToPath(file)))).toEqual([]);
  });

  it("keeps the Collector Runtime Web client compatibility barrel acyclic", () => {
    const absoluteBarrel = resolve(repoRoot, webCompatibilityBarrel);
    expect(existsSync(absoluteBarrel)).toBe(true);

    const graph = collectRelativeModuleGraph(absoluteBarrel, { extensions: [".ts", ".tsx"] });
    const cycle = findModuleGraphCycle(graph);

    expect(cycle).toBeNull();
  });

  it("keeps Collector Runtime Web client family modules from importing their compatibility barrel", () => {
    const familyDirectory = resolve(
      repoRoot,
      "apps/web/src/lib/api/collector-runtime",
    );

    if (!existsSync(familyDirectory)) {
      return;
    }

    const violations: string[] = [];
    const familyFiles = collectWebTypeScriptFiles(
      pathToFileURL(`${familyDirectory}/`),
    ).filter((file) => !file.pathname.endsWith(".test.ts"));

    for (const file of familyFiles) {
      const source = readFileSync(file, "utf8");
      if (referencesCompatibilityBarrel(source, "collector-runtime-client.ts")) {
        violations.push(relative(repoRoot, fileURLToPath(file)));
      }
    }

    expect(violations).toEqual([]);
  });
});
