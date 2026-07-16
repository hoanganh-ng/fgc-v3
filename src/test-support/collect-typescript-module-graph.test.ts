import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectRelativeModuleGraph,
  extractRelativeModuleSpecifiers,
  findModuleGraphCycle,
  referencesCompatibilityBarrel,
} from "./collect-typescript-module-graph";

describe("collect-typescript-module-graph", () => {
  it("discovers re-export edges from export and export type statements", () => {
    const source = `
      export { registerRoutes } from "./family.routes";
      export type { FamilyDto } from "./family.routes";
      export * from "./family.schemas";
    `;

    expect(extractRelativeModuleSpecifiers(source)).toEqual([
      "./family.routes",
      "./family.schemas",
    ]);
  });

  it("rejects a synthetic re-export cycle", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fgc-module-graph-"));
    const entry = join(tempDir, "entry.ts");
    const middle = join(tempDir, "middle.ts");
    const leaf = join(tempDir, "leaf.ts");

    writeFileSync(entry, `export { value } from "./middle";\n`);
    writeFileSync(middle, `export { value } from "./leaf";\n`);
    writeFileSync(leaf, `export { value } from "./entry";\n`);

    const graph = collectRelativeModuleGraph(entry);
    const cycle = findModuleGraphCycle(graph);

    expect(cycle).not.toBeNull();
    expect(cycle).toEqual([entry, middle, leaf, entry]);
  });

  it("follows re-export edges when building a compatibility barrel graph", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fgc-module-graph-"));
    const barrel = join(tempDir, "barrel.ts");
    const family = join(tempDir, "family.ts");

    writeFileSync(family, `export const familyValue = 1;\n`);
    writeFileSync(barrel, `export { familyValue } from "./family";\n`);

    const graph = collectRelativeModuleGraph(barrel);

    expect(graph.get(resolve(barrel))).toEqual([resolve(family)]);
  });

  it("rejects a synthetic cycle crossing sibling route and schema directories", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fgc-module-graph-http-"));
    const routesDir = join(tempDir, "routes");
    const schemasDir = join(tempDir, "schemas");
    const routesFamilyDir = join(routesDir, "collector-runtime");
    const schemasFamilyDir = join(schemasDir, "collector-runtime");

    mkdirSync(routesFamilyDir, { recursive: true });
    mkdirSync(schemasFamilyDir, { recursive: true });

    const routesBarrel = join(routesDir, "collector-runtime.routes.ts");
    const routeFamily = join(routesFamilyDir, "collection-runs.routes.ts");
    const schemaFamily = join(schemasFamilyDir, "collection-runs.http-schemas.ts");

    writeFileSync(
      routesBarrel,
      `export { registerRoutes } from "./collector-runtime/collection-runs.routes";\n`,
    );
    writeFileSync(
      routeFamily,
      `export { registerRoutes } from "../../schemas/collector-runtime/collection-runs.http-schemas";\n`,
    );
    writeFileSync(
      schemaFamily,
      `export { RouteSchema } from "../../routes/collector-runtime.routes";\n`,
    );

    const graph = collectRelativeModuleGraph(routesBarrel, {
      scopeDirectories: [routesDir, schemasDir],
    });
    const cycle = findModuleGraphCycle(graph);

    expect(cycle).not.toBeNull();
    expect(cycle).toEqual([
      resolve(routesBarrel),
      resolve(routeFamily),
      resolve(schemaFamily),
      resolve(routesBarrel),
    ]);
  });

  it.each([
    `import { routes } from "../collector-runtime.routes";`,
    `export type { RouteDto } from "../collector-runtime.http-schemas";`,
    `export * from "../collector-runtime-client";`,
  ])("detects compatibility barrel references in family modules (%s)", (source) => {
    expect(
      referencesCompatibilityBarrel(source, "collector-runtime.routes"),
    ).toBe(source.includes("collector-runtime.routes"));
    expect(
      referencesCompatibilityBarrel(source, "collector-runtime.http-schemas"),
    ).toBe(source.includes("collector-runtime.http-schemas"));
    expect(
      referencesCompatibilityBarrel(source, "collector-runtime-client"),
    ).toBe(source.includes("collector-runtime-client"));
  });
});
