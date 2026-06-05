import type { Clock } from "../../collector-profile-manager/application";

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
