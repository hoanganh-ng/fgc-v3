export type ProfileStatus = "PENDING_CONFIG" | "PENDING_LOGIN" | "READY" | "BUSY";

export interface IdentityMetadata {
  displayName: string;
  externalRef?: string | undefined;
  tags: string[];
}

export interface NetworkContext {
  proxy: {
    host: string;
    port: number;
    username?: string | undefined;
    password?: string | undefined;
  };
  killswitchEnabled: boolean;
}

export interface HardwareFingerprint {
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  languageHeaders: string[];
  hardwareConcurrency: number;
}

export interface CookieSnapshot {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number | undefined;
  httpOnly?: boolean | undefined;
  secure?: boolean | undefined;
  sameSite?: "Strict" | "Lax" | "None" | undefined;
}

export interface LocalStorageSnapshot {
  origin: string;
  entries: Record<string, string>;
}

export interface AuthenticationState {
  cookies: CookieSnapshot[];
  localStorage: LocalStorageSnapshot[];
  capturedAt: Date;
}

export interface BehavioralPersona {
  scrollingStyle: "SMOOTH" | "STEPPED" | "ERRATIC";
  microDelayMs: {
    min: number;
    max: number;
  };
  reverseScrollProbability: number;
}

export interface ActiveWindow {
  dayOfWeek: number;
  start: string;
  end: string;
}

export interface TemporalRoutine {
  timezone: string;
  activeWindows: ActiveWindow[];
  cooldownMinutes: number;
}

export interface SafetyThresholds {
  maxSessionsPerDay: number;
  maxSessionDurationMinutes: number;
  maxMacroActionsPerDay: number;
}

export interface ContentAffinities {
  primaryTopics: string[];
  secondaryTopics: string[];
  interactionWeights: Record<string, number>;
}

export interface ProfilePillars {
  identityMetadata: IdentityMetadata;
  networkContext: NetworkContext | null;
  hardwareFingerprint: HardwareFingerprint | null;
  authenticationState: AuthenticationState | null;
  behavioralPersona: BehavioralPersona | null;
  temporalRoutine: TemporalRoutine | null;
  safetyThresholds: SafetyThresholds | null;
  contentAffinities: ContentAffinities | null;
}

export interface ProfileConfigurationInput {
  identityMetadata?: IdentityMetadata | undefined;
  networkContext: NetworkContext;
  hardwareFingerprint: HardwareFingerprint;
  behavioralPersona: BehavioralPersona;
  temporalRoutine: TemporalRoutine;
  safetyThresholds: SafetyThresholds;
  contentAffinities: ContentAffinities;
}

export interface DailySafetyMetrics {
  date: string;
  sessionCount: number;
  macroActionCount: number;
  totalDurationMinutes: number;
}

export interface ActiveLease {
  id: string;
  holder?: string | undefined;
  expiresAt: Date;
}

export interface ProfileAggregate {
  id: string;
  status: ProfileStatus;
  version: number;
  pillars: ProfilePillars;
  provisioningTokenHash: string | null;
  provisioningTokenExpiresAt: Date | null;
  nextAvailableWindowAt: Date | null;
  dailySafetyMetrics: DailySafetyMetrics;
  activeLease: ActiveLease | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProvisioningTokenIssue {
  token: string;
  expiresAt: Date;
}

export interface CheckoutLease {
  leaseId: string;
  profile: ProfileAggregate;
  expiresAt: Date;
}
