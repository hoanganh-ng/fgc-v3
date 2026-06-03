import type { ActiveWindow, DailySafetyMetrics, TemporalRoutine } from "./types.js";

const weekdayToNumber: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

export interface LocalTimeSnapshot {
  dayOfWeek: number;
  minutesSinceMidnight: number;
  dateKey: string;
}

export function getLocalTimeSnapshot(now: Date, timezone: string): LocalTimeSnapshot {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value])
  );
  const weekday = parts["weekday"];
  const hour = Number(parts["hour"]);
  const minute = Number(parts["minute"]);
  const month = parts["month"];
  const day = parts["day"];
  const year = parts["year"];

  if (
    weekday === undefined ||
    weekdayToNumber[weekday] === undefined ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    month === undefined ||
    day === undefined ||
    year === undefined
  ) {
    throw new RangeError(`Unable to compute local time for timezone ${timezone}`);
  }

  return {
    dayOfWeek: weekdayToNumber[weekday],
    minutesSinceMidnight: hour * 60 + minute,
    dateKey: `${year}-${month}-${day}`
  };
}

export function isWithinActiveWindow(now: Date, routine: TemporalRoutine): boolean {
  const local = getLocalTimeSnapshot(now, routine.timezone);
  return routine.activeWindows.some((window) => isWindowActive(local, window));
}

export function resetMetricsIfNewLocalDay(
  metrics: DailySafetyMetrics,
  now: Date,
  timezone: string
): DailySafetyMetrics {
  const dateKey = getLocalTimeSnapshot(now, timezone).dateKey;

  if (metrics.date === dateKey) {
    return metrics;
  }

  return {
    date: dateKey,
    sessionCount: 0,
    macroActionCount: 0,
    totalDurationMinutes: 0
  };
}

function isWindowActive(local: LocalTimeSnapshot, window: ActiveWindow): boolean {
  const start = parseTimeOfDay(window.start);
  const end = parseTimeOfDay(window.end);

  if (start <= end) {
    return local.dayOfWeek === window.dayOfWeek &&
      local.minutesSinceMidnight >= start &&
      local.minutesSinceMidnight < end;
  }

  const nextDay = (window.dayOfWeek + 1) % 7;
  return (local.dayOfWeek === window.dayOfWeek && local.minutesSinceMidnight >= start) ||
    (local.dayOfWeek === nextDay && local.minutesSinceMidnight < end);
}

function parseTimeOfDay(value: string): number {
  const [hour, minute] = value.split(":").map(Number);

  if (
    hour === undefined ||
    minute === undefined ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    throw new RangeError(`Invalid time-of-day value ${value}`);
  }

  return hour * 60 + minute;
}
