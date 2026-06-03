export const adminApiKey = process.env["E2E_ADMIN_API_KEY"] ?? "e2e-admin-api-key";
export const composeProjectName = process.env["E2E_COMPOSE_PROJECT"] ?? "dtpm-e2e";
export const postgresHostPort = process.env["E2E_POSTGRES_HOST_PORT"] ?? "15432";
export const webHostPort = process.env["E2E_WEB_HOST_PORT"] ?? "18081";
export const baseUrl = process.env["E2E_BASE_URL"] ?? `http://127.0.0.1:${webHostPort}`;
export const keepStack = process.env["E2E_KEEP_STACK"] === "1";
