import type { AdministrativeMetadata } from './value-objects/administrative-metadata.value-object';
import type { AuthSessionState } from './value-objects/auth-session-state.value-object';
import type { BehavioralPersona } from './value-objects/behavioral-persona.value-object';
import type { ContentPreferences } from './value-objects/content-preferences.value-object';
import type { HardwareFingerprint } from './value-objects/hardware-fingerprint.value-object';
import type { Lifecycle } from './value-objects/lifecycle.value-object';
import type { NetworkIdentity } from './value-objects/network-identity.value-object';
import type { Routine } from './value-objects/routine.value-object';

export interface Profile {
  administrativeMetadata: AdministrativeMetadata;
  networkIdentity: NetworkIdentity;
  hardwareFingerprint: HardwareFingerprint;
  authSessionState: AuthSessionState;
  behavioralPersona: BehavioralPersona;
  contentPreferences: ContentPreferences;
  routine: Routine;
  lifecycle: Lifecycle;
}
