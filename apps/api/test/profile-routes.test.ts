import { afterEach, describe, expect, it } from "vitest";
import { ProfileService } from "@dtpm/core";
import type {
  Clock,
  IdGenerator,
  ProfileAggregate,
  ProfileConfigurationInput,
  ProfileRepository,
  TokenGenerator
} from "@dtpm/core";
import { buildApp } from "../src/app.js";

describe("profile routes", () => {
  const apps: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("requires the admin API key for admin routes", async () => {
    const app = await testApp();
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/admin/profiles"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: "ADMIN_AUTH_REQUIRED"
    });
  });

  it("creates a pending profile shell", async () => {
    const app = await testApp();
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/admin/profiles",
      headers: {
        "x-admin-api-key": "test-admin-api-key"
      },
      payload: {
        displayName: "weekday-profile"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      profile: {
        status: "PENDING_CONFIG",
        pillars: {
          networkContext: null,
          authenticationState: null
        }
      }
    });
  });

  it("performs provisioning handshake and rejects token replay", async () => {
    const app = await testApp();
    apps.push(app);
    const created = await app.inject({
      method: "POST",
      url: "/admin/profiles",
      headers: {
        "x-admin-api-key": "test-admin-api-key"
      },
      payload: {
        displayName: "weekday-profile"
      }
    });
    const profileId = created.json<{ profile: { id: string } }>().profile.id;
    const configured = await app.inject({
      method: "PUT",
      url: `/admin/profiles/${profileId}/configuration`,
      headers: {
        "x-admin-api-key": "test-admin-api-key"
      },
      payload: configuration()
    });
    const token = configured.json<{ provisioningToken: { token: string } }>().provisioningToken.token;

    const provisioningConfig = await app.inject({
      method: "GET",
      url: "/provisioning/configuration",
      headers: {
        "x-provisioning-token": token
      }
    });
    const ingested = await app.inject({
      method: "POST",
      url: "/provisioning/session",
      headers: {
        "x-provisioning-token": token
      },
      payload: {
        authenticationState: {
          cookies: [],
          localStorage: []
        }
      }
    });
    const replay = await app.inject({
      method: "POST",
      url: "/provisioning/session",
      headers: {
        "x-provisioning-token": token
      },
      payload: {
        authenticationState: {
          cookies: [],
          localStorage: []
        }
      }
    });

    expect(provisioningConfig.statusCode).toBe(200);
    expect(ingested.statusCode).toBe(200);
    expect(ingested.json()).toMatchObject({
      profile: {
        status: "READY"
      }
    });
    expect(replay.statusCode).toBe(409);
  });
});

async function testApp() {
  const profileService = new ProfileService({
    repository: new MemoryProfileRepository(),
    clock: new FixedClock(new Date("2026-06-01T10:00:00.000Z")),
    ids: new SequenceIds(),
    tokens: new StaticTokens(),
    provisioningTokenTtlMinutes: 30,
    checkoutLeaseTtlMinutes: 30
  });

  return buildApp({
    profileService,
    adminApiKey: "test-admin-api-key",
    corsOrigin: "http://localhost:5173"
  });
}

class MemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, ProfileAggregate>();

  async insert(profile: ProfileAggregate): Promise<void> {
    this.profiles.set(profile.id, profile);
  }

  async update(profile: ProfileAggregate): Promise<void> {
    this.profiles.set(profile.id, profile);
  }

  async findById(id: string): Promise<ProfileAggregate | null> {
    return this.profiles.get(id) ?? null;
  }

  async findByProvisioningTokenHash(tokenHash: string): Promise<ProfileAggregate | null> {
    return Array.from(this.profiles.values()).find((profile) => profile.provisioningTokenHash === tokenHash) ?? null;
  }

  async findCheckoutCandidates(): Promise<ProfileAggregate[]> {
    return Array.from(this.profiles.values()).filter((profile) => profile.status === "READY");
  }

  async list(): Promise<ProfileAggregate[]> {
    return Array.from(this.profiles.values());
  }
}

class FixedClock implements Clock {
  constructor(private readonly value: Date) {}

  now(): Date {
    return this.value;
  }
}

class SequenceIds implements IdGenerator {
  private readonly ids = [
    "2d3c61d6-c2a4-49e4-aee0-b5adbd87f7df",
    "f0f313f1-8f48-4f08-8d68-8482b135f5db",
    "335ecbf7-c0c5-4cb5-aa41-09582df361d0"
  ];
  private index = 0;

  newId(): string {
    const id = this.ids[this.index] ?? "8dd0ef13-3e86-4c47-af31-6cd689095f7e";
    this.index += 1;
    return id;
  }
}

class StaticTokens implements TokenGenerator {
  async generateProvisioningToken(): Promise<{ rawToken: string; tokenHash: string }> {
    return {
      rawToken: "test-token-with-at-least-thirty-two-characters",
      tokenHash: "hashed-test-token"
    };
  }

  async hashProvisioningToken(): Promise<string> {
    return "hashed-test-token";
  }
}

function configuration(): ProfileConfigurationInput {
  return {
    networkContext: {
      proxy: {
        host: "203.0.113.10",
        port: 8080
      },
      killswitchEnabled: true
    },
    hardwareFingerprint: {
      userAgent: "Mozilla/5.0",
      viewport: {
        width: 1366,
        height: 768
      },
      languageHeaders: ["en-US", "en"],
      hardwareConcurrency: 8
    },
    behavioralPersona: {
      scrollingStyle: "SMOOTH",
      microDelayMs: {
        min: 120,
        max: 900
      },
      reverseScrollProbability: 0.08
    },
    temporalRoutine: {
      timezone: "UTC",
      activeWindows: [
        {
          dayOfWeek: 1,
          start: "09:00",
          end: "17:00"
        }
      ],
      cooldownMinutes: 5
    },
    safetyThresholds: {
      maxSessionsPerDay: 3,
      maxSessionDurationMinutes: 45,
      maxMacroActionsPerDay: 100
    },
    contentAffinities: {
      primaryTopics: ["news"],
      secondaryTopics: ["technology"],
      interactionWeights: {
        like: 0.3
      }
    }
  };
}
