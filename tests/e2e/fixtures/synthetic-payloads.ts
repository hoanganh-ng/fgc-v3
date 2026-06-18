/**
 * Synthetic fixtures for the Sprint 062 baseline E2E flow.
 *
 * These fixtures are deterministic, isolated to the E2E run, and never
 * reference real Facebook identifiers, sessions, cookies, localStorage,
 * tokens, proxies, account IDs, or payloads. They are intentionally
 * suffixed with the run timestamp so repeated runs produce fresh records
 * in the isolated E2E database.
 */

export interface SyntheticCategoryFixture {
  readonly name: string;
  readonly slug: string;
  readonly description: string;
}

export interface SyntheticSourceGroupFixture {
  readonly platform: "FACEBOOK";
  readonly externalGroupId: string;
  readonly name: string;
  readonly url: string;
  readonly categoryId: string;
  readonly status: "ACTIVE";
  readonly collectionPriority: number;
  readonly notes: string;
}

export function buildCategoryFixture(
  runStamp: string,
): SyntheticCategoryFixture {
  return {
    name: `Sprint 062 Category ${runStamp}`,
    slug: `sprint-062-cat-${runStamp}`,
    description:
      "Synthetic Content Manager category created by the Sprint 062 baseline E2E flow.",
  };
}

export function buildSourceGroupFixture(
  runStamp: string,
  categoryId: string,
): SyntheticSourceGroupFixture {
  return {
    platform: "FACEBOOK",
    externalGroupId: `sprint-062-ext-${runStamp}`,
    name: `Sprint 062 Source Group ${runStamp}`,
    // Synthetic URL only. Never opened, never resolved.
    url: `https://example.invalid/sprint-062-${runStamp}`,
    categoryId,
    status: "ACTIVE",
    collectionPriority: 0,
    notes: "Synthetic Content Manager source group created by Sprint 062 E2E.",
  };
}

export function buildRunStamp(): string {
  // Deterministic per run, isolated across runs, filesystem-safe.
  return (
    process.env.E2E_RUN_STAMP?.trim() ||
    new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14)
  );
}