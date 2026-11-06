/**
 * The de minimis indirect cost calculator (2 CFR 200.414(f)): 15 percent of modified total direct
 * costs (MTDC). MTDC (2 CFR 200.1) means direct salaries and wages, fringe benefits, materials and
 * supplies, services, travel, and up to the first US$50,000 of each subaward. It excludes equipment,
 * capital expenditures, patient care, rental costs, tuition remission, scholarships and
 * fellowships, participant support costs, and the part of each subaward above US$50,000.
 *
 * Pure module. Amounts are numbers in the award's currency; the rule is written for US dollars.
 */

import { DE_MINIMIS_RATE, MTDC_SUBAWARD_CAP_USD } from "./rules";

export interface DeMinimisInput {
  /** Salaries, wages, fringe, materials, supplies, services, travel: the included direct costs. */
  includedDirectCosts: number;
  /** Equipment, capital, patient care, rent, tuition, scholarships, participant support. */
  excludedDirectCosts: number;
  /** Each subaward's full amount. Only the first US$50,000 of each counts. */
  subawards: number[];
}

export interface DeMinimisResult {
  rate: number;
  subawardCap: number;
  /** The part of the subawards that counts. */
  subawardsIncluded: number;
  /** The part of the subawards above the cap, left out. */
  subawardsExcluded: number;
  mtdc: number;
  indirect: number;
  /** Direct costs plus the indirect amount. */
  totalWithIndirect: number;
}

function clean(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function deMinimisIndirect(input: DeMinimisInput): DeMinimisResult {
  const included = clean(input.includedDirectCosts);
  const excluded = clean(input.excludedDirectCosts);
  let subawardsIncluded = 0;
  let subawardsExcluded = 0;
  for (const raw of input.subawards) {
    const amount = clean(raw);
    const counted = Math.min(amount, MTDC_SUBAWARD_CAP_USD);
    subawardsIncluded += counted;
    subawardsExcluded += amount - counted;
  }
  const mtdc = round2(included + subawardsIncluded);
  const indirect = round2(mtdc * DE_MINIMIS_RATE);
  return {
    rate: DE_MINIMIS_RATE,
    subawardCap: MTDC_SUBAWARD_CAP_USD,
    subawardsIncluded: round2(subawardsIncluded),
    subawardsExcluded: round2(subawardsExcluded),
    mtdc,
    indirect,
    totalWithIndirect: round2(
      included + excluded + subawardsIncluded + subawardsExcluded + indirect,
    ),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** One amount per line (or separated by spaces or semicolons); commas are thousands separators. */
export function parseAmountList(text: string): number[] {
  return text
    .split(/[\s;]+/)
    .map((part) => parseAmount(part))
    .filter((n): n is number => n !== null);
}

/**
 * "$12,500.75" → 12500.75; "(300)" or "-300" → -300; anything else → null. Only digits, one dot,
 * commas as thousands separators, a leading sign or currency sign, and parentheses are accepted, so
 * "1e5" or "€1.234,56" is refused rather than read as something else.
 */
export function parseAmount(text: string): number | null {
  let trimmed = text.trim();
  if (!trimmed) return null;
  let negative = false;
  if (/^\(.*\)$/.test(trimmed)) {
    negative = true;
    trimmed = trimmed.slice(1, -1).trim();
  }
  // A sign before or after the currency sign; a second sign inside parentheses is refused.
  const signed = /^([-+])?\s*(?:US\$|USD|\$)?\s*([-+])?\s*(.*)$/.exec(trimmed);
  if (!signed) return null;
  const signs = [signed[1], signed[2]].filter(Boolean);
  if (signs.length > 1 || (negative && signs.length > 0)) return null;
  if (signs[0] === "-") negative = true;
  trimmed = signed[3];
  if (!/^(\d{1,3}(,\d{3})*|\d+)?(\.\d*)?$/.test(trimmed) || !/\d/.test(trimmed)) return null;
  const value = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}
