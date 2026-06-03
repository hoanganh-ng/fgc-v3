import type { ProfileConfigurationRequest } from "@dtpm/contracts";

export const defaultConfiguration: ProfileConfigurationRequest = {
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
      like: 0.3,
      comment: 0.1
    }
  }
};
