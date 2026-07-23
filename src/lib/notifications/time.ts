// Belgrade-anchored calendar math: fire times for the saved-event reminders
// (Phase 6) and day boundaries for the Discover date presets.
//
// events.starts_at is stored so that its Europe/Belgrade wall-clock equals the
// intended event time (see src/lib/datetime.ts + the Phase 5 seed fix). A
// reminder "N days before" must fire N CALENDAR days earlier at the same
// Belgrade wall-clock time — plain `instant − N·24h` drifts by an hour when a
// CET/CEST switch falls inside the window. Hermes ships full Intl, so the zone
// conversion uses Intl.DateTimeFormat with an explicit timeZone (no tz library).

const BELGRADE = 'Europe/Belgrade';

const wallClockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: BELGRADE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: BELGRADE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The Belgrade wall-clock reading of an absolute instant. */
function belgradeWallClock(instant: Date): WallClock {
  const parts: Record<string, number> = {};
  for (const part of wallClockFormat.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/**
 * The absolute instant whose Belgrade wall-clock matches the given fields.
 * Starts from the wall-clock read as UTC and corrects by the zone offset seen
 * at the guessed instant; two passes converge (real offsets are hour-granular
 * and change at most once near the target).
 */
function instantFromBelgradeWallClock(wall: WallClock): Date {
  const wallAsUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  let guess = wallAsUtc;
  for (let pass = 0; pass < 2; pass++) {
    const seen = belgradeWallClock(new Date(guess));
    const seenAsUtc = Date.UTC(
      seen.year,
      seen.month - 1,
      seen.day,
      seen.hour,
      seen.minute,
      seen.second,
    );
    guess += wallAsUtc - seenAsUtc;
  }
  return new Date(guess);
}

/** Start of the Belgrade calendar day `daysAhead` days after the instant's day. */
export function belgradeStartOfDay(instant: Date, daysAhead = 0): Date {
  const wall = belgradeWallClock(instant);
  // Calendar addition on a UTC scratch date — immune to the device zone.
  const d = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + daysAhead));
  return instantFromBelgradeWallClock({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  });
}

/** Belgrade weekday of the instant: 0 = Sunday … 6 = Saturday. */
export function belgradeWeekday(instant: Date): number {
  const wall = belgradeWallClock(instant);
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
}

/** `startsAt` shifted `days` calendar days back, same Belgrade wall-clock time. */
export function belgradeDaysBefore(startsAt: Date, days: number): Date {
  const wall = belgradeWallClock(startsAt);
  // Calendar subtraction on a UTC scratch date — immune to the device zone.
  const shifted = new Date(Date.UTC(wall.year, wall.month - 1, wall.day - days));
  return instantFromBelgradeWallClock({
    ...wall,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

/** The event's Belgrade calendar day at `hour`:00 (the "day of" reminder slot). */
export function belgradeSameDayAt(startsAt: Date, hour: number): Date {
  const wall = belgradeWallClock(startsAt);
  return instantFromBelgradeWallClock({ ...wall, hour, minute: 0, second: 0 });
}

/** "21:00" — the instant's Belgrade time, for notification copy. */
export function belgradeTimeLabel(instant: Date): string {
  return timeFormat.format(instant);
}
