import { formatMoney, formatThreshold } from "@/lib/budget/money";
import { formatDate } from "@/lib/compliance/dates";
import { ecfrSectionUrl } from "@/lib/compliance/rules";
import type { SingleAuditStatus } from "@/lib/compliance/single-audit";

function headline(status: SingleAuditStatus): string {
  const fy = status.fiscalYear.label;
  if (status.basis === "recorded_spend")
    return `Single audit likely required for ${fy}: recorded federal spending reached the threshold.`;
  if (status.basis === "awards_in_force")
    return `Single audit possible for ${fy}: federal awards in force reach the threshold. Check with your auditor.`;
  if (status.awardsInForce === null && status.recordedSpend === 0)
    return `Cannot tell for ${fy}: no federal award amounts or spending recorded yet.`;
  return `Below the single-audit threshold for ${fy}, on what is recorded here.`;
}

/** The organization-wide single-audit flag (2 CFR 200.501). Shown on every federal award. */
export function SingleAuditCard({ status }: { status: SingleAuditStatus }) {
  const { fiscalYear } = status;
  return (
    <div className="space-y-3 text-sm">
      <p
        className={`rounded-md border px-3 py-2 font-medium ${
          status.flagged ? "border-destructive/40 bg-destructive/10" : "bg-muted/40"
        }`}
        role="status"
      >
        {headline(status)}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-y-1">
        <dt className="text-muted-foreground">Fiscal year</dt>
        <dd className="text-right">
          {formatDate(fiscalYear.start)} – {formatDate(fiscalYear.end)}
        </dd>
        <dt className="text-muted-foreground">Threshold</dt>
        <dd className="text-right">{formatThreshold(status.threshold)}</dd>
        <dt className={status.basis === "recorded_spend" ? "font-medium" : "text-muted-foreground"}>
          Federal spending recorded this year
        </dt>
        <dd className="text-right">{formatMoney(status.recordedSpend, "USD")}</dd>
        <dt
          className={status.basis === "awards_in_force" ? "font-medium" : "text-muted-foreground"}
        >
          Federal awards in force this year
        </dt>
        <dd className="text-right">
          {formatMoney(status.awardsInForce, "USD")}
          {status.unknownAmounts > 0 ? (
            <span className="block text-xs text-muted-foreground">
              plus {status.unknownAmounts} award{status.unknownAmounts === 1 ? "" : "s"} with no
              amount recorded
            </span>
          ) : null}
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">
        The rule counts money spent (2 CFR{" "}
        <a
          className="underline underline-offset-4"
          href={ecfrSectionUrl("501")}
          target="_blank"
          rel="noreferrer"
        >
          200.501
        </a>
        ). Spending comes from the actuals recorded on federal awards here; the award amounts are an
        upper bound so the flag turns on early rather than late. The fiscal year is taken as the
        calendar year until an organization setting says otherwise. Confirm with your auditor.
      </p>
    </div>
  );
}
