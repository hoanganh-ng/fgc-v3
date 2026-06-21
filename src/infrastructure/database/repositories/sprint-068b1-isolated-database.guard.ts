/**
 * Sprint 068B1 profile home-feed scheduled dispatch integration test
 * database-isolation guard.
 *
 * The Sprint 068B1 dispatch integration test runs end-to-end dispatch,
 * rollback, and concurrent-dispatcher scenarios against a real PostgreSQL
 * database. Because the production dispatcher selects every enabled due
 * schedule, prefix-based cleanup alone is not enough to keep shared
 * development data safe. The guard below forces the integration test to
 * run only against a dedicated, isolated database whose name explicitly
 * identifies it as a Sprint 068B1 disposable target.
 *
 * The guard fails fast before any `createDatabaseClient` call, and never
 * echoes credentials or the full connection URL in error messages.
 */

const ALLOWED_ISOLATED_DATABASE_NAME = "sprint_068b1_isolated";
const DISPOSABLE_DATABASE_NAME_PREFIX = "sprint_068b1_";

const REJECTED_DATABASE_NAMES = new Set<string>([
  "content_pipeline",
  "postgres",
]);

export class Sprint068B1IsolatedDatabaseGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Sprint068B1IsolatedDatabaseGuardError";
  }
}

/**
 * Resolve the database name from a Postgres connection URL without exposing
 * credentials. The URL parser strips the userinfo segment before parsing the
 * path so credentials never leak into thrown errors.
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

export function isAcceptedIsolatedDatabaseName(databaseName: string): boolean {
  if (databaseName === ALLOWED_ISOLATED_DATABASE_NAME) {
    return true;
  }

  return databaseName.startsWith(DISPOSABLE_DATABASE_NAME_PREFIX);
}

export interface ResolveIsolatedSprint068B1DatabaseOptions {
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Resolve and validate the Sprint 068B1 dispatch test database URL.
 *
 * Throws `Sprint068B1IsolatedDatabaseGuardError` before any
 * `createDatabaseClient` call when:
 *   - `SPRINT_068B1_DATABASE_URL` is missing or empty;
 *   - the URL cannot be parsed as a Postgres connection URL;
 *   - the database name is missing, shared, or not a Sprint 068B1
 *     disposable database (accepted: `sprint_068b1_isolated`, or
 *     names beginning with `sprint_068b1_`).
 *
 * Error messages never include credentials or the full connection URL.
 */
export function resolveIsolatedSprint068B1DatabaseUrl(
  options: ResolveIsolatedSprint068B1DatabaseOptions = {},
): string {
  const env = options.env ?? process.env;
  const databaseUrl = env.SPRINT_068B1_DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    throw new Sprint068B1IsolatedDatabaseGuardError(
      "SPRINT_068B1_DATABASE_URL is required to run the Sprint 068B1 " +
        "dispatch integration test. Set it to a dedicated isolated " +
        "database URL (for example, " +
        "postgresql://…/sprint_068b1_isolated). Do not run against " +
        "the shared content_pipeline database.",
    );
  }

  const databaseName = extractDatabaseName(databaseUrl);
  if (databaseName === null || databaseName === "") {
    throw new Sprint068B1IsolatedDatabaseGuardError(
      "SPRINT_068B1_DATABASE_URL must be a parsable Postgres connection " +
        "URL that names a dedicated isolated database.",
    );
  }

  if (REJECTED_DATABASE_NAMES.has(databaseName)) {
    throw new Sprint068B1IsolatedDatabaseGuardError(
      `SPRINT_068B1_DATABASE_URL targets the shared database "${databaseName}", ` +
        "which is not allowed for the Sprint 068B1 dispatch integration " +
        "test. Use a dedicated isolated database such as " +
        "sprint_068b1_isolated.",
    );
  }

  if (!isAcceptedIsolatedDatabaseName(databaseName)) {
    throw new Sprint068B1IsolatedDatabaseGuardError(
      `SPRINT_068B1_DATABASE_URL targets database "${databaseName}", which ` +
        "is not a Sprint 068B1 isolated database. Accepted names are " +
        '"sprint_068b1_isolated" or disposable names beginning with "sprint_068b1_".',
    );
  }

  return databaseUrl;
}
