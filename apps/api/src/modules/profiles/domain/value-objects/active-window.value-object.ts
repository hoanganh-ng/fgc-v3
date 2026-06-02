import type { TimeOfDay } from '../types/time-of-day.type';

export interface ActiveWindow {
  start: TimeOfDay;
  end: TimeOfDay;
}
