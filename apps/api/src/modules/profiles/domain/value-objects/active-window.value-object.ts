import type { TimeOfDay } from '../types/time-of-day.type.js';

export interface ActiveWindow {
  start: TimeOfDay;
  end: TimeOfDay;
}
