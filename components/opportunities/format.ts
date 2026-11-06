/** Display helpers. An absent fact reads "Not stated", never 0 or a blank (AGENTS.md honesty rule 1). */

export const NOT_STATED = "Not stated";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return NOT_STATED;
  const n = Number(amount);
  if (!Number.isFinite(n)) return NOT_STATED;
  return n === 0 ? "$0 (as stated by the agency)" : money.format(n);
}

export function formatCount(count: number | null | undefined): string {
  return count === null || count === undefined ? NOT_STATED : String(count);
}

const date = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** A YYYY-MM-DD date as "Jan 15, 2027". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return NOT_STATED;
  const parsed = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(parsed) ? date.format(new Date(parsed)) : NOT_STATED;
}

const dateTime = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

/** A timestamp in Eastern time, Grants.gov's clock. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return NOT_STATED;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? dateTime.format(new Date(parsed)) : NOT_STATED;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
