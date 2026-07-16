import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const relativeModuleSpecifierPattern =
  /(?:\bimport\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from|\bimport|\bexport\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\*|\w+)\s+from)\s+["']([^"']+)["']/g;

export function extractRelativeModuleSpecifiers(source: string): readonly string[] {
  const specifiers = new Set<string>();

  for (const match of source.matchAll(relativeModuleSpecifierPattern)) {
    const specifier = match[1];
    if (specifier?.startsWith(".")) {
      specifiers.add(specifier);
    }
  }

  return [...specifiers];
}

export function resolveRelativeModulePath(
  importerPath: string,
  importSpecifier: string,
  extensions: readonly string[] = [".ts", ".tsx"],
): string | null {
  if (!importSpecifier.startsWith(".")) {
    return null;
  }

  const importerDir = dirname(importerPath);
  const basePath = resolve(importerDir, importSpecifier);
  const candidatePaths = [
    basePath,
    ...extensions.map((extension) => `${basePath}${extension}`),
    ...extensions.map((extension) => resolve(basePath, `index${extension}`)),
  ];

  for (const candidate of candidatePaths) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

export function createServerHttpCompatibilityScopeDirectories(
  projectRoot: string,
): readonly string[] {
  return [
    resolve(projectRoot, "src/interfaces/http/routes"),
    resolve(projectRoot, "src/interfaces/http/schemas"),
  ];
}

export function collectRelativeModuleGraph(
  entryFile: string,
  options: {
    extensions?: readonly string[];
    scopeDirectories?: readonly string[];
  } = {},
): Map<string, string[]> {
  const extensions = options.extensions ?? [".ts", ".tsx"];
  const normalizedEntry = resolve(entryFile);
  const scopeDirectories = (options.scopeDirectories ?? [
    dirname(normalizedEntry),
    resolve(dirname(normalizedEntry), "collector-runtime"),
  ]).map((directory) => resolve(directory));

  const isInScope = (filePath: string): boolean => {
    const normalized = resolve(filePath);
    return scopeDirectories.some(
      (scopeDirectory) =>
        normalized === scopeDirectory ||
        normalized.startsWith(`${scopeDirectory}/`),
    );
  };

  const graph = new Map<string, string[]>();
  const queue = [normalizedEntry];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);
    const source = readFileSync(current, "utf8");
    const edges: string[] = [];

    for (const specifier of extractRelativeModuleSpecifiers(source)) {
      const resolved = resolveRelativeModulePath(current, specifier, extensions);
      if (resolved && isInScope(resolved)) {
        edges.push(resolved);
        if (!visited.has(resolved)) {
          queue.push(resolved);
        }
      }
    }

    graph.set(current, edges);
  }

  return graph;
}

export function findModuleGraphCycle(
  graph: Map<string, string[]>,
): readonly string[] | null {
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

export function referencesCompatibilityBarrel(
  source: string,
  barrelBasename: string,
): boolean {
  const barrelModuleName = barrelBasename.replace(/\.tsx?$/, "");

  return extractRelativeModuleSpecifiers(source).some((specifier) => {
    const normalized = specifier.replace(/\\/g, "/");
    return (
      normalized === `./${barrelModuleName}` ||
      normalized === `../${barrelModuleName}` ||
      normalized.endsWith(`/${barrelModuleName}`)
    );
  });
}
