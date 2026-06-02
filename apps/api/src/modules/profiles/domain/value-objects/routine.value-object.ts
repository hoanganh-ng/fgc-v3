import type { Chronotype } from '../types/chronotype.type';
import type { ActiveWindow } from './active-window.value-object';

export interface Routine {
  chronotype: Chronotype;
  activeWindows: ActiveWindow[];
  weekendVariance: boolean;
}
