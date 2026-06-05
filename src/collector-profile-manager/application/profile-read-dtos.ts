import type {
  BehavioralPersona,
  CollectorProfile,
  ContentAffinities,
  DailySafetyUsage,
  HardwareFingerprint,
  IanaTimezone,
  IsoDateTime,
  NetworkKillswitch,
  ProfileId,
  ProfileStatus,
  ProxyRouting,
  SafetyThresholds,
  TemporalRoutine,
} from "../domain";

export type ProfileReadProxyRouting = Omit<ProxyRouting, "credentials">;

export interface ProfileReadNetworkContext {
  readonly proxy: ProfileReadProxyRouting | null;
  readonly killswitch: NetworkKillswitch;
}

export interface ProfileSummary {
  readonly id: ProfileId;
  readonly displayName: string;
  readonly status: ProfileStatus;
  readonly timezone: IanaTimezone;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly lastCheckoutAt: IsoDateTime | null;
  readonly lastReleasedAt: IsoDateTime | null;
  readonly nextAvailableAt: IsoDateTime | null;
  readonly dailyUsage: DailySafetyUsage;
  readonly hasHardwareFingerprint: boolean;
  readonly hasAuthenticationState: boolean;
  readonly externalReference?: string;
  readonly labels?: readonly string[];
}

export interface ProfileDetail extends ProfileSummary {
  readonly networkContext: ProfileReadNetworkContext;
  readonly hardwareFingerprint: HardwareFingerprint | null;
  readonly behavioralPersona: BehavioralPersona;
  readonly temporalRoutine: TemporalRoutine;
  readonly safetyThresholds: SafetyThresholds;
  readonly contentAffinities: ContentAffinities;
}

export function toProfileSummaryDto(
  profile: CollectorProfile,
): ProfileSummary {
  return {
    id: profile.identity.id,
    displayName: profile.identity.displayName,
    status: profile.identity.status,
    timezone: profile.temporalRoutine.timezone,
    createdAt: profile.identity.createdAt,
    updatedAt: profile.identity.updatedAt,
    lastCheckoutAt: profile.identity.lastCheckoutAt,
    lastReleasedAt: profile.identity.lastReleasedAt,
    nextAvailableAt: profile.identity.nextAvailableAt,
    dailyUsage: profile.identity.dailyUsage,
    hasHardwareFingerprint: profile.hardwareFingerprint !== null,
    hasAuthenticationState:
      profile.authenticationState.sessionCapturedAt !== null ||
      profile.authenticationState.cookies.length > 0 ||
      profile.authenticationState.localStorage.length > 0,
    ...(profile.identity.externalReference !== undefined
      ? { externalReference: profile.identity.externalReference }
      : {}),
    ...(profile.identity.labels !== undefined
      ? { labels: [...profile.identity.labels] }
      : {}),
  };
}

export function toProfileDetailDto(profile: CollectorProfile): ProfileDetail {
  return {
    ...toProfileSummaryDto(profile),
    networkContext: toProfileReadNetworkContext(profile),
    hardwareFingerprint: profile.hardwareFingerprint,
    behavioralPersona: profile.behavioralPersona,
    temporalRoutine: profile.temporalRoutine,
    safetyThresholds: profile.safetyThresholds,
    contentAffinities: profile.contentAffinities,
  };
}

function toProfileReadNetworkContext(
  profile: CollectorProfile,
): ProfileReadNetworkContext {
  const { networkContext } = profile;

  if (networkContext.proxy === null) {
    return {
      proxy: null,
      killswitch: networkContext.killswitch,
    };
  }

  const { credentials: _credentials, ...proxy } = networkContext.proxy;

  return {
    proxy,
    killswitch: networkContext.killswitch,
  };
}
