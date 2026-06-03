import type { HardwareFingerprint, NetworkIdentity } from '../domain/index.js';
import type { IFingerprintGenerator } from '../ports/fingerprint-generator.interface.js';

export class BasicFingerprintGenerator implements IFingerprintGenerator {
  async generate(networkIdentity: NetworkIdentity): Promise<HardwareFingerprint> {
    return {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: {
        width: 1366,
        height: 768,
      },
      timezoneId: this.resolveTimezoneId(networkIdentity),
      languages: ['en-US', 'en'],
      hardwareConcurrency: 8,
      deviceMemory: 8,
    };
  }

  private resolveTimezoneId(_networkIdentity: NetworkIdentity): string {
    return 'UTC';
  }
}
