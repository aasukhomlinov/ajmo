import { format, isSameDay, parseISO } from 'date-fns';

// Event time formatting. All helpers take an ISO-8601 string (Event.starts_at /
// ends_at) and render in the device's local zone via date-fns. Kept in one place
// so the card chip, the meta row, and the day-section headers stay consistent.

/** Stable per-day grouping key, e.g. "2026-06-13". Local day. */
export function dayKey(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

/** Day-section header label, e.g. "Friday, Jun 12". */
export function daySectionLabel(iso: string): string {
  return format(parseISO(iso), 'EEEE, MMM d');
}

/** Lime cover chip, e.g. "FRI 12 JUN · 21:00" (date + start time, uppercased). */
export function dateChipLabel(iso: string): string {
  return `${format(parseISO(iso), 'EEE d MMM').toUpperCase()} · ${format(parseISO(iso), 'HH:mm')}`;
}

/** Meta-row time, e.g. "21:00" or "20:00 – 22:00" when an end time exists. */
export function timeLabel(startIso: string, endIso?: string): string {
  const start = format(parseISO(startIso), 'HH:mm');
  if (!endIso) return start;
  return `${start} – ${format(parseISO(endIso), 'HH:mm')}`;
}

/** True when the instant falls on the same calendar day as `reference`. */
export function isSameLocalDay(iso: string, reference: Date): boolean {
  return isSameDay(parseISO(iso), reference);
}
