import type { CollectionScheduleIsoDateTime } from "./collection-schedule";
import { CollectionScheduleIsoDateTimeSchema } from "./collection-schedule.schemas";

export class CollectionScheduleCadencePolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CollectionScheduleCadencePolicyError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const MS_PER_MINUTE = 60_000;

export function nextDispatchBoundary(
  previousNextRunAt: CollectionScheduleIsoDateTime,
  intervalMinutes: number,
  dispatchTime: CollectionScheduleIsoDateTime,
): CollectionScheduleIsoDateTime {
  assertIsoDateTime("previousNextRunAt", previousNextRunAt);
  assertIsoDateTime("dispatchTime", dispatchTime);

  assertIntervalMinutes(intervalMinutes);

  const previousMs = Date.parse(previousNextRunAt);
  const dispatchMs = Date.parse(dispatchTime);

  if (dispatchMs < previousMs) {
    throw new CollectionScheduleCadencePolicyError(
      `dispatchTime (${dispatchTime}) is earlier than previousNextRunAt (${previousNextRunAt}).`,
    );
  }

  const intervalMs = intervalMinutes * MS_PER_MINUTE;
  const k = Math.floor((dispatchMs - previousMs) / intervalMs) + 1;

  return new Date(previousMs + k * intervalMs).toISOString();
}

function assertIsoDateTime(label: string, value: string): void {
  const result = CollectionScheduleIsoDateTimeSchema.safeParse(value);

  if (!result.success) {
    throw new CollectionScheduleCadencePolicyError(
      `${label} is not a valid ISO datetime with offset: ${value}.`,
    );
  }
}

function assertIntervalMinutes(intervalMinutes: number): void {
  if (
    typeof intervalMinutes !== "number" ||
    !Number.isFinite(intervalMinutes) ||
    !Number.isInteger(intervalMinutes)
  ) {
    throw new CollectionScheduleCadencePolicyError(
      `intervalMinutes must be an integer: ${String(intervalMinutes)}.`,
    );
  }

  if (intervalMinutes < 1 || intervalMinutes > 10080) {
    throw new CollectionScheduleCadencePolicyError(
      `intervalMinutes must be between 1 and 10080: ${intervalMinutes}.`,
    );
  }
}
