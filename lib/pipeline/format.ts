/** Pure display helpers. An absent fact reads "Not stated", never 0 or a made-up value. */

export const NOT_STATED = "Not stated";

export function formatMoney(amount: number | string | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined || amount === "") return NOT_STATED;
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return NOT_STATED;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** A calendar date (YYYY-MM-DD) as "Dec 16, 2026". Dates have no zone, so they are read as given. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return NOT_STATED;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return NOT_STATED;
  const [, y, m, d] = match;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))));
}

/**
 * A moment as "Dec 16, 2026, 2:00 PM EST". Shown in the zone it was stated in when known,
 * otherwise in UTC, and always with the zone name so nobody misreads a deadline.
 */
export function formatDateTime(
  value: string | Date | null | undefined,
  timeZone: string | null = null,
  allDay = false,
): string {
  if (!value) return NOT_STATED;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return NOT_STATED;
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
  if (allDay) {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: zone }).format(date);
  }
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: zone,
    }).format(date) + (zone === "UTC" ? " UTC" : ` (${shortZoneName(date, zone)})`)
  );
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function shortZoneName(date: Date, zone: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? zone;
}

/** Whole days from today (UTC calendar days) to a moment; negative when it has passed. */
export function daysFromNow(value: string | Date, now = new Date()): number {
  const date = typeof value === "string" ? new Date(value) : value;
  const day = 24 * 60 * 60 * 1000;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const then = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((then - today) / day);
}

export function describeDueIn(days: number): string {
  if (days < -1) return `${-days} days ago`;
  if (days === -1) return "yesterday";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
