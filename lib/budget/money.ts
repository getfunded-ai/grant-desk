/**
 * Money for people. An unknown amount is "Not available", never 0 (AGENTS.md honesty rule 1).
 * Pure module.
 */

/** Postgres numeric comes back as a string; forms send strings; sums are numbers. */
export type MoneyInput = number | string | null | undefined;

export function toNumber(value: MoneyInput): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(value: MoneyInput, currency = "USD"): string {
  const n = toNumber(value);
  if (n === null) return "Not available";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/** A whole number of dollars for headline figures ("US$1,000,000"). */
export function formatThreshold(value: number): string {
  return `US$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

/** Sums the known amounts; null when none is known. */
export function sumKnown(values: MoneyInput[]): number | null {
  let sum: number | null = null;
  for (const value of values) {
    const n = toNumber(value);
    if (n === null) continue;
    sum = (sum ?? 0) + n;
  }
  return sum === null ? null : Math.round(sum * 100) / 100;
}

/** Rounds to cents before a numeric(16,2) column stores it. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
