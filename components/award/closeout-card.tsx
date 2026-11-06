import { closeOutAward } from "@/lib/compliance/actions";
import { formatDate, isoDateOf } from "@/lib/compliance/dates";
import {
  FINAL_REPORT_LAG_DAYS,
  RECORD_RETENTION_YEARS,
  ecfrSectionUrl,
} from "@/lib/compliance/rules";
import type { AwardReportRow, AwardRow, ComplianceItemRow } from "@/lib/compliance/store";
import { ActionForm } from "./action-form";

export function CloseoutCard({
  grantId,
  award,
  reports,
  items,
  canEdit,
}: {
  grantId: string;
  award: AwardRow;
  reports: AwardReportRow[];
  items: ComplianceItemRow[];
  canEdit: boolean;
}) {
  const reportsDue = reports.filter((r) => r.status === "due");
  const itemsOpen = items.filter((i) => !i.completed_at);
  const finalKind = award.is_federal ? "final_financial" : "final_performance";
  const finalReport = reports.find((r) => r.kind === finalKind);

  if (award.closed_at) {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">Closed out on {formatDate(isoDateOf(award.closed_at))}.</p>
        <p>
          Keep the records until{" "}
          <span className="font-medium">
            {award.records_retention_until
              ? formatDate(award.records_retention_until)
              : "Not available (the final report has no submitted date)"}
          </span>
          {award.is_federal ? (
            <>
              {" "}
              ({RECORD_RETENTION_YEARS} years after the final financial report, 2 CFR{" "}
              <a
                className="underline underline-offset-4"
                href={ecfrSectionUrl("334")}
                target="_blank"
                rel="noreferrer"
              >
                200.334
              </a>
              ).
            </>
          ) : (
            <> ({RECORD_RETENTION_YEARS} years after the final report; check the agreement).</>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-1">
        <li>
          {reportsDue.length === 0 ? "✓" : "•"} {reportsDue.length} report
          {reportsDue.length === 1 ? "" : "s"} still due
          {finalReport && finalReport.status === "due"
            ? `, including the final report due ${formatDate(finalReport.due_date)}`
            : ""}
          .
        </li>
        <li>
          {itemsOpen.length === 0 ? "✓" : "•"} {itemsOpen.length} checklist item
          {itemsOpen.length === 1 ? "" : "s"} open.
        </li>
        {award.is_federal ? (
          <li>
            • Final reports and all bills within {FINAL_REPORT_LAG_DAYS} days of the end date (2 CFR{" "}
            <a
              className="underline underline-offset-4"
              href={ecfrSectionUrl("344")}
              target="_blank"
              rel="noreferrer"
            >
              200.344
            </a>
            ).
          </li>
        ) : null}
      </ul>
      <p className="text-muted-foreground">
        Closing out records the date, sets the record-retention end date from the final report’s
        submitted date, and moves the grant to the Closed stage. Nothing is deleted.
      </p>
      {canEdit ? (
        <ActionForm
          action={closeOutAward}
          fields={{ grantId, awardId: award.id }}
          label="Close out this award"
          pendingLabel="Closing…"
          variant="default"
          size="default"
          confirm={
            reportsDue.length > 0 || itemsOpen.length > 0
              ? "Some reports or checklist items are still open. Close out anyway?"
              : "Close out this award and move the grant to Closed?"
          }
        />
      ) : null}
    </div>
  );
}
