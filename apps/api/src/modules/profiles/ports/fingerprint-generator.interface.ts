import type { HardwareFingerprint, NetworkIdentity } from '../domain/index.js';

export interface IFingerprintGenerator {
  generate(networkIdentity: NetworkIdentity): Promise<HardwareFingerprint>;
}
