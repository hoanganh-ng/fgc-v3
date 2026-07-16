import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const repoRoot = resolve(webRoot, "../..");

const forbiddenBackendImportPattern =
  /\b(?:from|import)\s*(?:\(\s*)?["'](?:\.\.\/){2,}src\/|["'][^"']*\/fgc-v3\/src\/[^"']*["']/;

const webCompatibilityBarrel =
  "apps/web/src/lib/api/collector-runtime-client.ts";

const importPattern =
  /\b(?:from|import)\s*(?:type\s*)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*(?:,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*)*from\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g;

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

function resolveImportPath(
  importerPath: string,
  importSpecifier: string,
): string | null {
  if (!importSpecifier.startsWith(".")) {
    return null;
  }

  const importerDir = dirname(importerPath);
  const candidatePaths = [
    resolve(importerDir, importSpecifier),
    `${resolve(importerDir, importSpecifier)}.ts`,
    `${resolve(importerDir, importSpecifier)}.tsx`,
    resolve(importerDir, importSpecifier, "index.ts"),
    resolve(importerDir, importSpecifier, "index.tsx"),
  ];

  for (const candidate of candidatePaths) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function collectRelativeImportGraph(entryFile: string): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const queue = [entryFile];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);
    const source = readFileSync(current, "utf8");
    const imports: string[] = [];

    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2];
      if (!specifier) {
        continue;
      }

      const resolved = resolveImportPath(current, specifier);
      if (resolved) {
        imports.push(resolved);
        if (!visited.has(resolved)) {
          queue.push(resolved);
        }
      }
    }

    graph.set(current, imports);
  }

  return graph;
}

function findCycle(graph: Map<string, string[]>): readonly string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (node: string): readonly string[] | null => {
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      return cycleStart === -1 ? [node, node] : [...stack.slice(cycleStart), node];
    }

    if (visited.has(node)) {
      return null;
    }

    visiting.add(node);
    stack.push(node);

    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  };

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

describe("web architecture boundary", () => {
  it("keeps the Web application from importing backend src modules", () => {
    const files = collectWebTypeScriptFiles(pathToFileURL(`${webRoot}/src/`));
    const offendingFiles = files.filter((file) =>
      forbiddenBackendImportPattern.test(readFileSync(file, "utf8")),
    );

    expect(offendingFiles.map((file) => relative(repoRoot, fileURLToPath(file)))).toEqual([]);
  });

  it("keeps the Collector Runtime Web client compatibility barrel acyclic", () => {
    const absoluteBarrel = resolve(repoRoot, webCompatibilityBarrel);
    expect(existsSync(absoluteBarrel)).toBe(true);

    const graph = collectRelativeImportGraph(absoluteBarrel);
    const cycle = findCycle(graph);

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

    const barrelBasename = "collector-runtime-client";
    const violations: string[] = [];
    const familyFiles = collectWebTypeScriptFiles(
      pathToFileURL(`${familyDirectory}/`),
    ).filter((file) => !file.pathname.endsWith(".test.ts"));

    for (const file of familyFiles) {
      const source = readFileSync(file, "utf8");
      if (source.includes(`./${barrelBasename}`)) {
        violations.push(relative(repoRoot, fileURLToPath(file)));
      }
    }

    expect(violations).toEqual([]);
  });
});
