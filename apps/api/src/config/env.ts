export interface ApiConfig {
  port: number;
  host: string;
  databasePath: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_DATABASE_PATH = 'data/profiles.db';

export function loadEnv(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    port: parsePort(env.PORT),
    host: readString(env.HOST, DEFAULT_HOST),
    databasePath: readString(env.DATABASE_PATH, DEFAULT_DATABASE_PATH),
  };
}

function parsePort(value: string | undefined): number {
  const rawPort = readString(value, String(DEFAULT_PORT));
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function readString(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : fallback;
}
