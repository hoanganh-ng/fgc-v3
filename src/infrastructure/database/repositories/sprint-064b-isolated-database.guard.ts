/**
 * Sprint 064B content-items migration backfill integration test
 * database-isolation guard.
 *
 * The Sprint 064B migration backfill test executes the 0018, 0019, and
 * 0020 migration chain against a real PostgreSQL database and inserts
 * a synthetic legacy content row before migration 0019 runs. To avoid
 * touching shared development data and to keep the migration chain
 * reproducible from a clean schema, the guard forces the test to run
 * only against a dedicated, isolated database whose name explicitly
 * identifies it as a Sprint 064B disposable target.
 *
 * The guard fails fast before any `createDatabaseClient` call, and
 * never echoes credentials or the full connection URL in error
 * messages.
 */

const ALLOWED_ISOLATED_DATABASE_NAME = "sprint_064b_isolated";
const DISPOSABLE_DATABASE_NAME_PREFIX = "sprint_064b_";

const REJECTED_DATABASE_NAMES = new Set<string>([
  "content_pipeline",
  "postgres",
]);

export class Sprint064BIsolatedDatabaseGuardError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "Sprint064BIsolatedDatabaseGuardError";
  }
}

/**
 * Resolve the database name from a Postgres connection URL without
 * exposing credentials. The URL parser strips the userinfo segment
 * before parsing the path so credentials never leak into thrown
 * errors.
 */
export function extractDatabaseName(databaseUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    return null;
  }

  const pathname = parsed.pathname.replace(/^\/+/, "");
  if (pathname === "") {
    return null;
  }

  const decoded = decodeURIComponent(pathname);
  const separatorIndex = decoded.indexOf("/");
  if (separatorIndex === -1) {
    return decoded;
  }

  return decoded.slice(separatorIndex + 1);
}

export function isAcceptedIsolatedDatabaseName(
  databaseName: string,
): boolean {
  if (databaseName === ALLOWED_ISOLATED_DATABASE_NAME) {
    return true;
  }

  return databaseName.startsWith(DISPOSABLE_DATABASE_NAME_PREFIX);
}

export interface ResolveIsolatedSprint064BDatabaseOptions {
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Resolve and validate the Sprint 064B migration backfill test database URL.
 *
 * Throws `Sprint064BIsolatedDatabaseGuardError` before any
 * `createDatabaseClient` call when:
 *   - `SPRINT_064B_DATABASE_URL` is missing or empty;
 *   - the URL cannot be parsed as a Postgres connection URL;
 *   - the database name is missing, shared, or not a Sprint 064B
 *     disposable database (accepted: `sprint_064b_isolated`, or names
 *     beginning with `sprint_064b_`).
 *
 * Error messages never include credentials or the full connection URL.
 */
export function resolveIsolatedSprint064BDatabaseUrl(
  options: ResolveIsolatedSprint064BDatabaseOptions = {},
): string {
  const env = options.env ?? process.env;
  const databaseUrl = env.SPRINT_064B_DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    throw new Sprint064BIsolatedDatabaseGuardError(
      "SPRINT_064B_DATABASE_URL is required to run the Sprint 064B " +
        "migration backfill integration test. Set it to a dedicated " +
        "isolated database URL (for example, " +
        "postgresql://…/sprint_064b_isolated). Do not run against " +
        "the shared content_pipeline database.",
    );
  }

  const databaseName = extractDatabaseName(databaseUrl);
  if (databaseName === null || databaseName === "") {
    throw new Sprint064BIsolatedDatabaseGuardError(
      "SPRINT_064B_DATABASE_URL must be a parsable Postgres " +
        "connection URL that names a dedicated isolated database.",
    );
  }

  if (REJECTED_DATABASE_NAMES.has(databaseName)) {
    throw new Sprint064BIsolatedDatabaseGuardError(
      `SPRINT_064B_DATABASE_URL targets the shared database ` +
        `"${databaseName}", which is not allowed for the Sprint 064B ` +
        "migration backfill integration test. Use a dedicated " +
        "isolated database such as sprint_064b_isolated.",
    );
  }

  if (!isAcceptedIsolatedDatabaseName(databaseName)) {
    throw new Sprint064BIsolatedDatabaseGuardError(
      `SPRINT_064B_DATABASE_URL targets database "${databaseName}", ` +
        "which is not a Sprint 064B isolated database. Accepted " +
        'names are "sprint_064b_isolated" or disposable names ' +
        'beginning with "sprint_064b_".',
    );
  }

  return databaseUrl;
}