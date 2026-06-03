import type { AdministrativeMetadata } from './value-objects/administrative-metadata.value-object.js';
import type { AuthSessionState } from './value-objects/auth-session-state.value-object.js';
import type { BehavioralPersona } from './value-objects/behavioral-persona.value-object.js';
import type { ContentPreferences } from './value-objects/content-preferences.value-object.js';
import type { HardwareFingerprint } from './value-objects/hardware-fingerprint.value-object.js';
import type { Lifecycle } from './value-objects/lifecycle.value-object.js';
import type { NetworkIdentity } from './value-objects/network-identity.value-object.js';
import type { Routine } from './value-objects/routine.value-object.js';

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
