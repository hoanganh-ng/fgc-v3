import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const REMOVED_ALIASES = [
  "stack:dev:worker:start",
  "stack:dev:worker:once",
  "stack:dev:worker:logs",
  "stack:dev:exercise-worker:start",
  "stack:dev:exercise-worker:once",
  "stack:dev:exercise-worker:logs",
  "stack:dev:scheduler:start",
  "stack:dev:scheduler:once",
  "stack:dev:scheduler:logs",
  "stack:dev:profile-home-feed-scheduler:start",
  "stack:dev:profile-home-feed-scheduler:once",
  "stack:dev:profile-home-feed-scheduler:logs",
  "stack:dev:profile-home-feed-worker:start",
  "stack:dev:profile-home-feed-worker:once",
  "stack:dev:profile-home-feed-worker:logs",
  "stack:dev:workers:start",
  "stack:dev:workers:logs",
  "stack:preview:worker:start",
  "stack:preview:worker:once",
  "stack:preview:worker:logs",
  "stack:preview:exercise-worker:start",
  "stack:preview:exercise-worker:once",
  "stack:preview:exercise-worker:logs",
  "stack:preview:scheduler:start",
  "stack:preview:scheduler:once",
  "stack:preview:scheduler:logs",
  "stack:preview:profile-home-feed-scheduler:start",
  "stack:preview:profile-home-feed-scheduler:once",
  "stack:preview:profile-home-feed-scheduler:logs",
  "stack:preview:profile-home-feed-worker:start",
  "stack:preview:profile-home-feed-worker:once",
  "stack:preview:profile-home-feed-worker:logs",
  "stack:preview:workers:start",
  "stack:preview:workers:logs",
  "test:e2e:container",
] as const;

const PRESERVED_LIFECYCLE = [
  "stack:dev:start",
  "stack:dev:stop",
  "stack:dev:reset",
  "stack:preview:start",
  "stack:preview:stop",
  "stack:preview:reset",
] as const;

const PRESERVED_OPERATOR = [
  "operator:profile:provision",
  "operator:profile:provision:cloakbrowser-probe",
  "operator:collector:facebook",
  "operator:collector:worker",
  "operator:collector:scheduler",
  "operator:profile-home-feed:scheduler",
  "operator:profile-home-feed-worker",
  "operator:profile:exercise",
  "operator:profile:exercise-worker",
  "operator:profile-source-access-check-worker",
  "operator:profile:assisted-access",
  "operator:profile-home-feed:run-next",
  "operator:browser:probe",
] as const;

describe("package.json stack-service consolidation", () => {
  it("contains exactly 35 scripts with stack:service and preserved commands", () => {
    const packageJson = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const scriptNames = Object.keys(packageJson.scripts);

    expect(scriptNames).toHaveLength(35);
    expect(packageJson.scripts["stack:service"]).toBe(
      "tsx src/operator-tools/stack-service/cli.ts",
    );

    for (const name of PRESERVED_LIFECYCLE) {
      expect(scriptNames).toContain(name);
    }

    for (const name of PRESERVED_OPERATOR) {
      expect(scriptNames).toContain(name);
    }

    expect(scriptNames).toContain("test:db:dispatch:isolated");
    expect(scriptNames).toContain("test:db:provenance:isolated");
    expect(scriptNames).toContain("test:e2e:docker");

    for (const alias of REMOVED_ALIASES) {
      expect(scriptNames).not.toContain(alias);
      expect(JSON.stringify(packageJson.scripts)).not.toContain(`"${alias}"`);
    }
  });

  it("teaches stack:service in current docs and does not direct operators to removed aliases as live scripts", () => {
    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    const runtime = readFileSync(join(ROOT, "docs/RUNTIME.md"), "utf8");
    const testingStrategy = readFileSync(
      join(ROOT, "docs/TESTING_STRATEGY.md"),
      "utf8",
    );

    expect(readme).toContain("pnpm stack:service --");
    expect(runtime).toContain("pnpm stack:service --");
    expect(runtime).toContain("Removed stack service aliases (Sprint 078)");
    expect(testingStrategy).toContain("invokes Playwright directly");
    expect(testingStrategy).not.toContain("test:e2e:container");

    // Active command examples must use stack:service, not the old matrix.
    const activeExampleBlocks = [
      ...readme.matchAll(/```bash\n([\s\S]*?)```/g),
      ...runtime.matchAll(/```bash\n([\s\S]*?)```/g),
    ].map((match) => match[1] ?? "");

    for (const block of activeExampleBlocks) {
      for (const alias of REMOVED_ALIASES) {
        expect(block).not.toContain(`pnpm ${alias}`);
      }
    }
  });
});
