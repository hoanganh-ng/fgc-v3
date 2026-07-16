import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { collectTypeScriptFiles } from "./collect-typescript-files";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const moduleDomainApplicationRoots = [
  "src/collector-profile-manager/domain",
  "src/collector-profile-manager/application",
  "src/content-manager/domain",
  "src/content-manager/application",
  "src/content-builder/domain",
  "src/content-builder/application",
  "src/collector-runtime/domain",
  "src/collector-runtime/application",
] as const;

const forbiddenDomainApplicationAdapterPattern =
  /\b(?:from|import)\s*(?:\(\s*)?["'][^"']*(?:fastify|interfaces\/http|\/http\/|infrastructure\/database|drizzle|postgres|composition\/|playwright|puppeteer|selenium|browserless|cloakbrowser)[^"']*["']/i;

const crossModuleRepositoryPatterns = [
  {
    moduleRoot: "src/collector-profile-manager",
    forbidden:
      /\b(?:from|import)\s*(?:\(\s*)?["'][^"']*(?:content-manager\/(?:infrastructure|application\/ports)|drizzle-content|drizzle-source-group|drizzle-source-publisher|content-manager\.schema)[^"']*["']/i,
  },
  {
    moduleRoot: "src/content-manager",
    forbidden:
      /\b(?:from|import)\s*(?:\(\s*)?["'][^"']*(?:collector-profile-manager\/(?:infrastructure|application\/ports)|drizzle-profile|collector-profile-manager\.schema)[^"']*["']/i,
  },
  {
    moduleRoot: "src/collector-runtime",
    forbidden:
      /\b(?:from|import)\s*(?:\(\s*)?["'][^"']*(?:(?:collector-profile-manager|content-manager|content-builder)\/(?:infrastructure|composition)|drizzle-(?:profile|content|source|transform)|(?:collector-profile-manager|content-manager|content-builder)\.schema)[^"']*["']/i,
  },
  {
    moduleRoot: "src/content-builder",
    forbidden:
      /\b(?:from|import)\s*(?:\(\s*)?["'][^"']*(?:(?:collector-profile-manager|content-manager|collector-runtime)\/(?:infrastructure|composition)|drizzle-(?:profile|content|source)|(?:collector-profile-manager|content-manager|collector-runtime)\.schema)[^"']*["']/i,
  },
] as const;

const serverCompatibilityBarrels = [
  "src/interfaces/http/routes/collector-runtime.routes.ts",
  "src/interfaces/http/schemas/collector-runtime.http-schemas.ts",
] as const;

const importPattern =
  /\b(?:from|import)\s*(?:type\s*)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*(?:,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*)*from\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g;

function readModuleSourceFiles(moduleRoot: string): readonly URL[] {
  const absoluteRoot = resolve(projectRoot, moduleRoot);
  if (!existsSync(absoluteRoot)) {
    return [];
  }

  return collectTypeScriptFiles(pathToFileURL(`${absoluteRoot}/`)).filter(
    (file) => !file.pathname.endsWith(".test.ts"),
  );
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
    resolve(importerDir, importSpecifier, "index.ts"),
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

describe("global architecture boundary", () => {
  it("keeps domain and application layers free of HTTP, database, composition, and browser adapters", () => {
    const files = moduleDomainApplicationRoots.flatMap((root) =>
      collectTypeScriptFiles(pathToFileURL(`${resolve(projectRoot, root)}/`)),
    );
    const offendingFiles = files.filter((file) =>
      forbiddenDomainApplicationAdapterPattern.test(
        readFileSync(file, "utf8"),
      ),
    );

    expect(offendingFiles.map((file) => file.pathname)).toEqual([]);
  });

  it("keeps modules from importing another module repositories or database schema", () => {
    const violations: string[] = [];

    for (const { moduleRoot, forbidden } of crossModuleRepositoryPatterns) {
      for (const file of readModuleSourceFiles(moduleRoot)) {
        if (forbidden.test(readFileSync(file, "utf8"))) {
          violations.push(relative(projectRoot, fileURLToPath(file)));
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps Collector Runtime HTTP compatibility barrels acyclic", () => {
    for (const barrelPath of serverCompatibilityBarrels) {
      const absoluteBarrel = resolve(projectRoot, barrelPath);
      expect(existsSync(absoluteBarrel)).toBe(true);

      const graph = collectRelativeImportGraph(absoluteBarrel);
      const cycle = findCycle(graph);

      expect(cycle, `cycle detected for ${barrelPath}`).toBeNull();
    }
  });

  it("keeps Collector Runtime HTTP family modules from importing their compatibility barrels", () => {
    const violations: string[] = [];

    for (const barrelPath of serverCompatibilityBarrels) {
      const familyDirectory = resolve(
        projectRoot,
        dirname(barrelPath),
        "collector-runtime",
      );

      if (!existsSync(familyDirectory)) {
        continue;
      }

      const barrelBasename = barrelPath.split("/").at(-1);
      const familyFiles = collectTypeScriptFiles(
        pathToFileURL(`${familyDirectory}/`),
      ).filter((file) => !file.pathname.endsWith(".test.ts"));

      for (const file of familyFiles) {
        const source = readFileSync(file, "utf8");
        if (
          barrelBasename &&
          source.includes(`./${barrelBasename.replace(/\.ts$/, "")}`)
        ) {
          violations.push(relative(projectRoot, fileURLToPath(file)));
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
