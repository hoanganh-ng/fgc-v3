import type { LifecycleStage } from '../types/lifecycle-stage.type';
import type { SafetyLimits } from './safety-limits.value-object';

export interface Lifecycle {
  stage: LifecycleStage;
  accountCreatedAt: Date;
  safetyLimits: SafetyLimits;
}
