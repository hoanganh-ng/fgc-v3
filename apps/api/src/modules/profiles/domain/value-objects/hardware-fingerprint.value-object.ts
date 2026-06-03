import type { Viewport } from './viewport.value-object.js';

export interface HardwareFingerprint {
  userAgent: string;
  viewport: Viewport;
  timezoneId: string;
  languages: string[];
  hardwareConcurrency: number;
  deviceMemory: number;
}
