/**
 * The report schedule for an award, from its period of performance and reporting frequency.
 *
 * Federal awards follow 2 CFR 200: an SF-425 financial report and a performance report for every
 * reporting period, due INTERIM_REPORT_LAG_DAYS after the period ends, and a final pair due
 * FINAL_REPORT_LAG_DAYS after the period of performance ends (200.328, 200.329, 200.344). The last
 * period is covered by the final reports, so it gets no interim pair.
 *
 * Non-federal awards get a plain schedule from what the person typed: one report per period, due
 * `reportLagDays` after the period ends, and a final report due `finalReportLagDays` after the end
 * date.
 *
 * Pure module. Dates are ISO strings; see dates.ts.
 */

import { type IsoDate, addDays, addMonths, compareIsoDates } from "./dates";
import { FINAL_REPORT_LAG_DAYS, INTERIM_REPORT_LAG_DAYS } from "./rules";

export type ReportFrequency = "quarterly" | "semiannual" | "annual" | "none";

export type ReportKind = "financial" | "performance" | "final_financial" | "final_performance";

export interface ScheduledReport {
  kind: ReportKind;
  title: string;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  dueDate: IsoDate;
}

export interface ScheduleInput {
  periodStart: IsoDate;
  periodEnd: IsoDate;
  frequency: ReportFrequency;
  isFederal: boolean;
  /** Non-federal only: days after a period ends that its report is due. */
  reportLagDays: number;
  /** Non-federal only: days after the end date that the final report is due. */
  finalReportLagDays: number;
}

const MONTHS_PER_PERIOD: Record<Exclude<ReportFrequency, "none">, number> = {
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export const FREQUENCY_LABELS: Record<ReportFrequency, string> = {
  quarterly: "Quarterly",
  semiannual: "Every six months",
  annual: "Annual",
  none: "No regular reports",
};

/** The reporting periods inside the period of performance, in order. */
export function reportingPeriods(
  periodStart: IsoDate,
  periodEnd: IsoDate,
  frequency: ReportFrequency,
): Array<{ start: IsoDate; end: IsoDate }> {
  if (frequency === "none" || compareIsoDates(periodStart, periodEnd) > 0) return [];
  const months = MONTHS_PER_PERIOD[frequency];
  const periods: Array<{ start: IsoDate; end: IsoDate }> = [];
  let start = periodStart;
  // Guard against a runaway loop on bad input: 50 years of quarterly periods is plenty.
  while (compareIsoDates(start, periodEnd) <= 0 && periods.length < 200) {
    const nextStart = addMonths(start, months);
    const end =
      compareIsoDates(addDays(nextStart, -1), periodEnd) < 0 ? addDays(nextStart, -1) : periodEnd;
    periods.push({ start, end });
    start = nextStart;
  }
  return periods;
}

function periodLabel(index: number, frequency: ReportFrequency, end: IsoDate): string {
  const year = end.slice(0, 4);
  switch (frequency) {
    case "quarterly":
      return `quarter ${index + 1} (to ${end})`;
    case "semiannual":
      return `half ${index + 1} (to ${end})`;
    case "annual":
      return `year ${index + 1} (to ${end})`;
    default:
      return year;
  }
}

/** Every report due on the award, in due-date order. Empty when the dates are missing or reversed. */
export function generateReportSchedule(input: ScheduleInput): ScheduledReport[] {
  const { periodStart, periodEnd, frequency, isFederal } = input;
  if (compareIsoDates(periodStart, periodEnd) > 0) return [];

  const reports: ScheduledReport[] = [];
  const periods = reportingPeriods(periodStart, periodEnd, frequency);
  // The final reports cover the last period, so interim reports stop one period early.
  const interim = periods.slice(0, -1);
  const interimLag =
    frequency === "none"
      ? 0
      : isFederal
        ? INTERIM_REPORT_LAG_DAYS[frequency]
        : Math.max(0, Math.floor(input.reportLagDays));

  interim.forEach((period, index) => {
    const dueDate = addDays(period.end, interimLag);
    const label = periodLabel(index, frequency, period.end);
    if (isFederal) {
      reports.push({
        kind: "financial",
        title: `SF-425 financial report, ${label}`,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate,
      });
      reports.push({
        kind: "performance",
        title: `Performance report, ${label}`,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate,
      });
    } else {
      reports.push({
        kind: "performance",
        title: `Report to funder, ${label}`,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate,
      });
    }
  });

  const lastStart = periods.length > 0 ? periods[periods.length - 1].start : periodStart;
  const finalLag = isFederal
    ? FINAL_REPORT_LAG_DAYS
    : Math.max(0, Math.floor(input.finalReportLagDays));
  const finalDue = addDays(periodEnd, finalLag);
  if (isFederal) {
    reports.push({
      kind: "final_financial",
      title: "Final SF-425 financial report",
      periodStart: lastStart,
      periodEnd,
      dueDate: finalDue,
    });
    reports.push({
      kind: "final_performance",
      title: "Final performance report",
      periodStart: lastStart,
      periodEnd,
      dueDate: finalDue,
    });
  } else {
    reports.push({
      kind: "final_performance",
      title: "Final report to funder",
      periodStart: lastStart,
      periodEnd,
      dueDate: finalDue,
    });
  }

  return reports.sort(
    (a, b) => compareIsoDates(a.dueDate, b.dueDate) || a.kind.localeCompare(b.kind),
  );
}
