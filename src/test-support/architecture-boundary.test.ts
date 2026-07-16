import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { collectTypeScriptFiles } from "./collect-typescript-files";
import {
  collectRelativeModuleGraph,
  findModuleGraphCycle,
  referencesCompatibilityBarrel,
} from "./collect-typescript-module-graph";

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

function readModuleSourceFiles(moduleRoot: string): readonly URL[] {
  const absoluteRoot = resolve(projectRoot, moduleRoot);
  if (!existsSync(absoluteRoot)) {
    return [];
  }

  return collectTypeScriptFiles(pathToFileURL(`${absoluteRoot}/`)).filter(
    (file) => !file.pathname.endsWith(".test.ts"),
  );
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

      const graph = collectRelativeModuleGraph(absoluteBarrel);
      const cycle = findModuleGraphCycle(graph);

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
      if (!barrelBasename) {
        continue;
      }

      const familyFiles = collectTypeScriptFiles(
        pathToFileURL(`${familyDirectory}/`),
      ).filter((file) => !file.pathname.endsWith(".test.ts"));

      for (const file of familyFiles) {
        const source = readFileSync(file, "utf8");
        if (referencesCompatibilityBarrel(source, barrelBasename)) {
          violations.push(relative(projectRoot, fileURLToPath(file)));
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
