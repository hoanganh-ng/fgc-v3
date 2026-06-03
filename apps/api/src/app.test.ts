import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { PROFILE_SQLITE_SCHEMA } from './modules/profiles/adapters/profile.sqlite.repository.js';

function createMemoryDatabase() {
  return new Database(':memory:');
}

describe('buildApp', () => {
  let app: FastifyInstance | undefined;
  let database: ReturnType<typeof createMemoryDatabase> | undefined;

  beforeEach(() => {
    database = createMemoryDatabase();
    database.exec(PROFILE_SQLITE_SCHEMA);
    app = buildApp(database);
  });

  afterEach(async () => {
    await app?.close();
    database?.close();
  });

  it('creates a profile and returns a provisioning token', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/api/profiles',
      payload: {
        name: 'Integration Test Profile',
        networkIdentity: {
          proxy: {
            server: '127.0.0.1',
            port: 8080,
            protocol: 'http',
            username: null,
            password: null,
          },
          networkKillSwitch: true,
        },
        behavioralPersona: {
          personaType: 'STANDARD_RESEARCHER',
          scrollPattern: 'measured',
          macroDelayMs: {
            min: 250,
            max: 1250,
          },
          upwardScrollChance: 0.2,
        },
        contentPreferences: {
          primaryTopics: ['technology'],
          secondaryTopics: ['productivity'],
          engagementProbability: 0.4,
        },
        routine: {
          chronotype: '9_TO_5_WORKER',
          activeWindows: [
            {
              start: '09:00',
              end: '17:00',
            },
          ],
          weekendVariance: false,
        },
        lifecycle: {
          stage: 'TIER_1_NEWBIE',
          accountCreatedAt: '2024-01-01T00:00:00.000Z',
          safetyLimits: {
            maxSessionsPerDay: 3,
            maxDurationMinutes: 45,
            maxActionsPerSession: 30,
          },
        },
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json<{ provisioningToken: string }>();

    expect(body.provisioningToken).toEqual(expect.any(String));
    expect(body.provisioningToken).toHaveLength(64);
  });
});
