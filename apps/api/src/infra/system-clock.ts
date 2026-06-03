import type { Clock } from "@dtpm/core";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
