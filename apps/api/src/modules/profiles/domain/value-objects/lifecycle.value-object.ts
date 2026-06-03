import type { LifecycleStage } from '../types/lifecycle-stage.type.js';
import type { SafetyLimits } from './safety-limits.value-object.js';

export interface Lifecycle {
  stage: LifecycleStage;
  accountCreatedAt: Date;
  safetyLimits: SafetyLimits;
}
