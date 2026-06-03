import { describe, expect, it } from "vitest";
import { ProfileService } from "../src/index.js";
import type {
  Clock,
  IdGenerator,
  ProfileAggregate,
  ProfileConfigurationInput,
  ProfileRepository,
  TokenGenerator
} from "../src/index.js";

describe("profile service", () => {
  it("exposes raw provisioning tokens only when they are issued", async () => {
    const repository = new MemoryProfileRepository();
    const service = new ProfileService({
      repository,
      clock: new FixedClock(new Date("2026-06-01T10:00:00.000Z")),
      ids: new SequenceIds(),
      tokens: new StaticTokens(),
      provisioningTokenTtlMinutes: 30,
      checkoutLeaseTtlMinutes: 30
    });

    const profile = await service.createProfile({ displayName: "managed" });
    const configured = await service.configureProfile(profile.id, configuration());
    const config = await service.getProvisioningConfig("raw-token");
    const ready = await service.ingestSession("raw-token", { cookies: [], localStorage: [] });

    expect(configured.provisioningToken?.token).toBe("raw-token");
    expect(config.profileId).toBe(profile.id);
    expect(ready.status).toBe("READY");
    await expect(service.getProvisioningConfig("raw-token")).rejects.toMatchObject({
      code: "NO_ELIGIBLE_PROFILE"
    });
  });
});

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
  private index = 0;

  newId(): string {
    this.index += 1;
    return this.index === 1
      ? "2d3c61d6-c2a4-49e4-aee0-b5adbd87f7df"
      : "f0f313f1-8f48-4f08-8d68-8482b135f5db";
  }
}

class StaticTokens implements TokenGenerator {
  async generateProvisioningToken(): Promise<{ rawToken: string; tokenHash: string }> {
    return {
      rawToken: "raw-token",
      tokenHash: "hashed-token"
    };
  }

  async hashProvisioningToken(): Promise<string> {
    return "hashed-token";
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
