import { formatMoney } from "@/lib/budget/money";
import type { GrantForAward } from "@/lib/compliance/access";
import { formatDate } from "@/lib/compliance/dates";
import { FREQUENCY_LABELS } from "@/lib/compliance/schedule";
import type { AwardRow } from "@/lib/compliance/store";

const PAYMENT_LABELS: Record<NonNullable<AwardRow["payment_method"]>, string> = {
  reimbursement: "Reimbursement",
  advance: "Advance",
  lump_sum: "Lump sum",
  other: "Other",
};

const INDIRECT_LABELS: Record<NonNullable<AwardRow["indirect_method"]>, string> = {
  de_minimis: "De minimis rate, 15% of modified total direct costs",
  negotiated_rate: "Negotiated rate",
  none: "None charged",
  other: "Other",
};

export function TermsSummary({ grant, award }: { grant: GrantForAward; award: AwardRow }) {
  const indirect = award.indirect_method ? INDIRECT_LABELS[award.indirect_method] : "Not stated";
  const rate =
    award.indirect_rate !== null &&
    (award.indirect_method === "negotiated_rate" || award.indirect_method === "other")
      ? ` at ${award.indirect_rate}%`
      : "";
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
      <dt className="text-muted-foreground">Amount awarded</dt>
      <dd>{formatMoney(grant.amount_awarded, grant.currency)}</dd>
      <dt className="text-muted-foreground">Period of performance</dt>
      <dd>
        {grant.award_start_date || grant.award_end_date
          ? `${formatDate(grant.award_start_date)} – ${formatDate(grant.award_end_date)}`
          : "Not available"}
      </dd>
      <dt className="text-muted-foreground">Award number</dt>
      <dd>{award.award_number ?? "Not stated"}</dd>
      <dt className="text-muted-foreground">Kind</dt>
      <dd>{award.is_federal ? "Federal (2 CFR 200 applies)" : "Not federal"}</dd>
      <dt className="text-muted-foreground">Payment</dt>
      <dd>{award.payment_method ? PAYMENT_LABELS[award.payment_method] : "Not stated"}</dd>
      <dt className="text-muted-foreground">Indirect costs</dt>
      <dd>
        {indirect}
        {rate}
      </dd>
      <dt className="text-muted-foreground">Reports</dt>
      <dd>
        {FREQUENCY_LABELS[award.report_frequency]}
        {!award.is_federal && award.report_frequency !== "none"
          ? `, ${award.report_lag_days} days after each period; final ${award.final_report_lag_days} days after the end date`
          : ""}
      </dd>
      {award.notes ? (
        <>
          <dt className="text-muted-foreground">Notes</dt>
          <dd className="whitespace-pre-wrap">{award.notes}</dd>
        </>
      ) : null}
    </dl>
  );
}
