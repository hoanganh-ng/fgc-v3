import type { HardwareFingerprint, NetworkIdentity } from '../domain';

export interface IFingerprintGenerator {
  generate(networkIdentity: NetworkIdentity): Promise<HardwareFingerprint>;
}
