/**
 * The single-audit flag (2 CFR 200.501): an organization that expends US$1,000,000 or more in
 * federal awards during its fiscal year must have a single audit (or a program-specific audit).
 *
 * The rule is about money spent, so the first basis is the actuals recorded on federal awards in
 * the fiscal year. Many organizations record no actuals here, so the second basis is the federal
 * award amounts whose period of performance overlaps the fiscal year: an upper bound that turns the
 * flag on early rather than late. The result says which basis applies and never claims more than
 * the numbers typed in. Unknown amounts are left out and counted, so the page can say so.
 *
 * Pure module.
 */

import { type IsoDate, compareIsoDates } from "./dates";
import { SINGLE_AUDIT_THRESHOLD_USD } from "./rules";

export interface FederalAwardAmount {
  /** Null = the amount is not known ("Not available"). */
  amount: number | null;
  periodStart: IsoDate | null;
  periodEnd: IsoDate | null;
}

export interface FederalActual {
  spentOn: IsoDate;
  amount: number;
}

export interface FiscalYear {
  start: IsoDate;
  end: IsoDate;
  label: string;
}

export interface SingleAuditStatus {
  fiscalYear: FiscalYear;
  threshold: number;
  /** Federal spending recorded as actuals inside the fiscal year. */
  recordedSpend: number;
  /** Federal award amounts in force during the fiscal year (an upper bound on what could be spent).
   * 0 when no federal award overlaps the year; null when awards overlap but none has an amount. */
  awardsInForce: number | null;
  /** Federal awards whose amount is not known, so they could not be counted. */
  unknownAmounts: number;
  flagged: boolean;
  basis: "recorded_spend" | "awards_in_force" | "none";
}

/**
 * The fiscal year that contains `today` for an organization whose fiscal year ends in
 * `fiscalYearEndMonth` (1–12; 12 = calendar year). The label is the calendar year the fiscal year
 * ends in, as auditors name it ("FY2027").
 */
export function fiscalYearContaining(today: IsoDate, fiscalYearEndMonth = 12): FiscalYear {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const endMonth = Math.min(12, Math.max(1, Math.floor(fiscalYearEndMonth)));
  const endYear = month <= endMonth ? year : year + 1;
  const endDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  const startMonth = endMonth === 12 ? 1 : endMonth + 1;
  const startYear = endMonth === 12 ? endYear : endYear - 1;
  const start = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
  return { start, end, label: `FY${endYear}` };
}

function overlaps(award: FederalAwardAmount, fy: FiscalYear): boolean {
  // An award with no dates is assumed to be in force: better to flag early than to miss an audit.
  const startsBeforeEnd = !award.periodStart || compareIsoDates(award.periodStart, fy.end) <= 0;
  const endsAfterStart = !award.periodEnd || compareIsoDates(award.periodEnd, fy.start) >= 0;
  return startsBeforeEnd && endsAfterStart;
}

export function singleAuditStatus(
  awards: FederalAwardAmount[],
  actuals: FederalActual[],
  fiscalYear: FiscalYear,
  threshold = SINGLE_AUDIT_THRESHOLD_USD,
): SingleAuditStatus {
  let known: number | null = null;
  let unknownAmounts = 0;
  let overlapping = 0;
  for (const award of awards) {
    if (!overlaps(award, fiscalYear)) continue;
    overlapping += 1;
    if (award.amount === null) unknownAmounts += 1;
    else known = (known ?? 0) + award.amount;
  }
  const awardsInForce = overlapping === 0 ? 0 : known;
  const recordedSpend = actuals
    .filter(
      (a) =>
        compareIsoDates(a.spentOn, fiscalYear.start) >= 0 &&
        compareIsoDates(a.spentOn, fiscalYear.end) <= 0,
    )
    .reduce((sum, a) => sum + a.amount, 0);

  const basis =
    recordedSpend >= threshold
      ? "recorded_spend"
      : awardsInForce !== null && awardsInForce >= threshold
        ? "awards_in_force"
        : "none";
  return {
    fiscalYear,
    threshold,
    recordedSpend,
    awardsInForce,
    unknownAmounts,
    flagged: basis !== "none",
    basis,
  };
}
