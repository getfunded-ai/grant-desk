import {
  deleteReport,
  markReportSubmitted,
  regenerateSchedule,
  reopenReport,
} from "@/lib/compliance/actions";
import { type IsoDate, daysBetween, formatDate } from "@/lib/compliance/dates";
import {
  FINAL_REPORT_LAG_DAYS,
  INTERIM_REPORT_LAG_DAYS,
  ecfrSectionUrl,
} from "@/lib/compliance/rules";
import type { AwardReportRow } from "@/lib/compliance/store";
import { ActionForm } from "./action-form";
import { AddReportForm } from "./small-forms";

const KIND_LABELS: Record<AwardReportRow["kind"], string> = {
  financial: "Financial",
  performance: "Performance",
  final_financial: "Final financial",
  final_performance: "Final performance",
  other: "Other",
};

function dueLabel(report: AwardReportRow, today: IsoDate): { text: string; tone: string } {
  if (report.status !== "due") {
    return {
      text: `${report.status === "accepted" ? "Accepted" : "Submitted"} ${formatDate(report.submitted_on)}`,
      tone: "text-muted-foreground",
    };
  }
  const days = daysBetween(today, report.due_date);
  if (days < 0)
    return {
      text: `Overdue by ${-days} day${days === -1 ? "" : "s"}`,
      tone: "text-destructive font-medium",
    };
  if (days === 0) return { text: "Due today", tone: "text-destructive font-medium" };
  if (days <= 30)
    return { text: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: "font-medium" };
  return { text: `Due in ${days} days`, tone: "text-muted-foreground" };
}

export function ReportSchedule({
  grantId,
  awardId,
  isFederal,
  hasPeriod,
  reports,
  today,
  canEdit,
}: {
  grantId: string;
  awardId: string;
  isFederal: boolean;
  hasPeriod: boolean;
  reports: AwardReportRow[];
  today: IsoDate;
  canEdit: boolean;
}) {
  const ids = { grantId, awardId };
  return (
    <div className="space-y-4">
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasPeriod
            ? "No reports yet. Regenerate the schedule or add one below."
            : "Add the period of performance in the terms above to generate the schedule."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Report</th>
                <th className="py-1 pr-3 font-medium">Period</th>
                <th className="py-1 pr-3 font-medium">Due</th>
                <th className="py-1 pr-3 font-medium">Status</th>
                {canEdit ? <th className="py-1 font-medium" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {reports.map((report) => {
                const due = dueLabel(report, today);
                return (
                  <tr key={report.id} className="align-top">
                    <td className="py-2 pr-3">
                      <div>{report.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {KIND_LABELS[report.kind]}
                        {report.generated ? " · from the schedule" : " · added by hand"}
                      </div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {report.period_start && report.period_end
                        ? `${formatDate(report.period_start)} – ${formatDate(report.period_end)}`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(report.due_date)}</td>
                    <td className={`py-2 pr-3 whitespace-nowrap ${due.tone}`}>{due.text}</td>
                    {canEdit ? (
                      <td className="py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {report.status === "due" ? (
                            <ActionForm
                              action={markReportSubmitted}
                              fields={{ grantId, reportId: report.id }}
                              label="Mark submitted"
                              pendingLabel="Saving…"
                              size="xs"
                            >
                              <input
                                type="date"
                                name="submittedOn"
                                defaultValue={today}
                                aria-label="Date submitted"
                                className="h-6 rounded-md border border-input bg-transparent px-1 text-xs"
                              />
                            </ActionForm>
                          ) : (
                            <ActionForm
                              action={reopenReport}
                              fields={{ grantId, reportId: report.id }}
                              label="Mark due again"
                              size="xs"
                              variant="ghost"
                            />
                          )}
                          <ActionForm
                            action={deleteReport}
                            fields={{ grantId, reportId: report.id }}
                            label="Remove"
                            size="xs"
                            variant="ghost"
                            confirm="Remove this report and its calendar entry?"
                          />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {isFederal ? (
          <>
            Federal rule: each SF-425 and performance report is due{" "}
            {INTERIM_REPORT_LAG_DAYS.quarterly} days after a quarter or half-year,{" "}
            {INTERIM_REPORT_LAG_DAYS.annual} days after a year, and the final reports{" "}
            {FINAL_REPORT_LAG_DAYS} days after the period of performance ends (2 CFR{" "}
            <a
              className="underline underline-offset-4"
              href={ecfrSectionUrl("328")}
              target="_blank"
              rel="noreferrer"
            >
              200.328
            </a>
            ,{" "}
            <a
              className="underline underline-offset-4"
              href={ecfrSectionUrl("329")}
              target="_blank"
              rel="noreferrer"
            >
              200.329
            </a>
            ,{" "}
            <a
              className="underline underline-offset-4"
              href={ecfrSectionUrl("344")}
              target="_blank"
              rel="noreferrer"
            >
              200.344
            </a>
            ). The agency’s notice of award can set different dates; check it.
          </>
        ) : (
          "Dates come from the frequency and the days after each period typed in the terms. Check them against the grant agreement."
        )}{" "}
        Every report here is also a deadline on the calendar.
      </p>

      {canEdit ? (
        <div className="space-y-4 border-t pt-4">
          <AddReportForm {...ids} />
          {hasPeriod ? (
            <ActionForm
              action={regenerateSchedule}
              fields={ids}
              label="Regenerate the schedule"
              pendingLabel="Regenerating…"
              variant="ghost"
              confirm="Replace the generated reports that are still due with a fresh schedule? Submitted reports and reports you added are kept."
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
