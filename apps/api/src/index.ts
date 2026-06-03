import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import Database from 'better-sqlite3';

import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { PROFILE_SQLITE_SCHEMA } from './modules/profiles/adapters/profile.sqlite.repository.js';

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

async function main(): Promise<void> {
  const config = loadEnv();

  ensureDatabaseDirectory(config.databasePath);

  const database = new Database(config.databasePath);
  database.exec(PROFILE_SQLITE_SCHEMA);

  const app = buildApp(database);
  let isShuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    app.log.info({ signal }, 'Shutting down API server');

    try {
      await app.close();
    } catch (error) {
      app.log.error({ err: error }, 'Failed to close Fastify cleanly');
      process.exitCode = 1;
    }

    try {
      database.close();
    } catch (error) {
      app.log.error({ err: error }, 'Failed to close SQLite database cleanly');
      process.exitCode = 1;
    }
  }

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }

  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start API server');
    database.close();
    process.exitCode = 1;
  }
}

function ensureDatabaseDirectory(databasePath: string): void {
  if (databasePath === ':memory:') {
    return;
  }

  mkdirSync(dirname(resolve(databasePath)), {
    recursive: true,
  });
}

void main();
