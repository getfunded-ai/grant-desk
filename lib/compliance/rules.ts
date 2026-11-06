/**
 * Federal post-award rules, from 2 CFR Part 200 (Uniform Guidance) as revised in 2024 and in force
 * for awards made on or after 1 October 2024. Each constant names its section. These are the only
 * places the numbers live; the schedule generator, the single-audit check and the de minimis
 * calculator import them from here. Nothing here applies to a non-federal award unless the person
 * chooses it.
 *
 * Pure module: no database, no React, safe to import anywhere.
 */

/** Days after the end of a reporting period that an interim report is due (2 CFR 200.328(b)(1)
 * for the SF-425 financial report; 200.329(c)(2) ties performance reports to the same schedule). */
export const INTERIM_REPORT_LAG_DAYS = {
  quarterly: 30,
  semiannual: 30,
  annual: 90,
} as const;

/** Days after the end of the period of performance that the final financial and performance
 * reports are due (2 CFR 200.344(b); 200.328(b)(1) and 200.329(c)(2) say the same). */
export const FINAL_REPORT_LAG_DAYS = 120;

/** Records are kept for three years from the date the final financial report was submitted
 * (2 CFR 200.334). */
export const RECORD_RETENTION_YEARS = 3;

/** A non-federal entity that spends this much or more in federal awards in its fiscal year must
 * have a single audit (2 CFR 200.501(a); the threshold rose from US$750,000 in the 2024 revision). */
export const SINGLE_AUDIT_THRESHOLD_USD = 1_000_000;

/** The de minimis indirect cost rate: 15 percent of modified total direct costs
 * (2 CFR 200.414(f), 2024 revision; it was 10 percent before). */
export const DE_MINIMIS_RATE = 0.15;

/** Modified total direct costs include only the first US$50,000 of each subaward
 * (2 CFR 200.1, definition of "modified total direct cost", 2024 revision; it was US$25,000). */
export const MTDC_SUBAWARD_CAP_USD = 50_000;

/** Where a person can read the rules themselves. */
export const ECFR_PART_200_URL =
  "https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200";

export function ecfrSectionUrl(section: string): string {
  return `${ECFR_PART_200_URL}/section-200.${section}`;
}
