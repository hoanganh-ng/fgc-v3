import type { Chronotype } from '../types/chronotype.type.js';
import type { ActiveWindow } from './active-window.value-object.js';

export interface Routine {
  chronotype: Chronotype;
  activeWindows: ActiveWindow[];
  weekendVariance: boolean;
}
