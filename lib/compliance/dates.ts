/**
 * Calendar-date arithmetic on ISO strings (YYYY-MM-DD). Everything here works in UTC on dates only,
 * so a due date never shifts by a day because of the server's time zone.
 */

export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The date as an ISO string, or null when it is not a real calendar date. */
export function parseIsoDate(value: unknown): IsoDate | null {
  if (typeof value !== "string") return null;
  const match = ISO_DATE.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return toIsoDate(date);
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

function toUtc(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

/** Adds calendar months, clamping to the last day of the month (31 Jan + 1 month = 28 or 29 Feb). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const d = toUtc(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return toIsoDate(d);
}

export function addYears(date: IsoDate, years: number): IsoDate {
  return addMonths(date, years * 12);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Today as an ISO date, in UTC. */
export function todayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

/** "30 Apr 2027" style, for people. */
export function formatDate(date: IsoDate | null | undefined): string {
  if (!date) return "Not available";
  const d = toUtc(date);
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The ISO date of a timestamp, in UTC. */
export function isoDateOf(timestamp: string | null | undefined): IsoDate | null {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? null : toIsoDate(d);
}
