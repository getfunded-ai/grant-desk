import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AwardTermsForm,
  type AwardTermsValues,
  EMPTY_TERMS,
} from "@/components/award/award-terms-form";
import { BudgetSection } from "@/components/award/budget-section";
import { Checklist } from "@/components/award/checklist";
import { CloseoutCard } from "@/components/award/closeout-card";
import { DeMinimisCalculator } from "@/components/award/de-minimis-calculator";
import { Reimbursements } from "@/components/award/reimbursements";
import { ReportSchedule } from "@/components/award/report-schedule";
import { SingleAuditCard } from "@/components/award/single-audit-card";
import { TermsSummary } from "@/components/award/terms-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveOrganization } from "@/lib/auth/session";
import { EDITOR_ROLES } from "@/lib/compliance/access";
import { todayIso } from "@/lib/compliance/dates";
import { fiscalYearContaining, singleAuditStatus } from "@/lib/compliance/single-audit";
import { loadAwardPage } from "@/lib/compliance/store";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Award · Grant Desk" };

/**
 * Everything after the grant is won: terms, the report schedule (also on the calendar), budget
 * versus actual, reimbursements, the compliance checklist and close-out. Phase E's grant record
 * page links here. Reads run as the signed-in person, so row-level security applies.
 */
export default async function AwardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { active } = await requireActiveOrganization();
  const supabase = await createClient();
  if (!supabase) notFound();
  const data = await loadAwardPage(supabase, active.id, id);
  if (!data) notFound();

  const { grant, funderName, award } = data;
  const canEdit = EDITOR_ROLES.includes(active.role);
  const today = todayIso();
  const initial: AwardTermsValues = award
    ? {
        isFederal: award.is_federal,
        awardNumber: award.award_number ?? "",
        amountAwarded: grant.amount_awarded === null ? "" : String(grant.amount_awarded),
        periodStart: grant.award_start_date ?? "",
        periodEnd: grant.award_end_date ?? "",
        paymentMethod: award.payment_method ?? "",
        indirectMethod: award.indirect_method ?? "",
        indirectRate: award.indirect_rate === null ? "" : String(award.indirect_rate),
        reportFrequency: award.report_frequency,
        reportLagDays: award.report_lag_days,
        finalReportLagDays: award.final_report_lag_days,
        notes: award.notes ?? "",
      }
    : {
        ...EMPTY_TERMS,
        amountAwarded: grant.amount_awarded === null ? "" : String(grant.amount_awarded),
        periodStart: grant.award_start_date ?? "",
        periodEnd: grant.award_end_date ?? "",
      };

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <Link href={`/grants/${grant.id}`} className="underline underline-offset-4">
            {grant.title}
          </Link>
          {funderName ? ` · ${funderName}` : ""}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Award and compliance</h1>
        {!canEdit ? (
          <p className="text-sm text-muted-foreground">
            You can read this page. Only an editor, admin or owner can change it.
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Award terms</CardTitle>
          <CardDescription>
            {award
              ? "What the funder agreed to. Saving changes regenerates the report schedule."
              : "Enter the award to start the report schedule, the budget and the checklist."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {award ? <TermsSummary grant={grant} award={award} /> : null}
          {canEdit ? (
            award ? (
              <details>
                <summary className="cursor-pointer text-sm underline underline-offset-4">
                  Edit the terms
                </summary>
                <div className="pt-4">
                  <AwardTermsForm grantId={grant.id} initial={initial} isNew={false} />
                </div>
              </details>
            ) : (
              <AwardTermsForm grantId={grant.id} initial={initial} isNew />
            )
          ) : !award ? (
            <p className="text-sm text-muted-foreground">No award has been entered yet.</p>
          ) : null}
        </CardContent>
      </Card>

      {award ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Reports due</CardTitle>
              <CardDescription>Each one is a deadline on the calendar.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReportSchedule
                grantId={grant.id}
                awardId={award.id}
                isFederal={award.is_federal}
                hasPeriod={Boolean(grant.award_start_date && grant.award_end_date)}
                reports={data.reports}
                today={today}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>

          {award.is_federal ? (
            <div className="grid gap-8 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Single audit</CardTitle>
                  <CardDescription>Across every federal award in {active.name}.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SingleAuditCard
                    status={singleAuditStatus(
                      data.federal.awards,
                      data.federal.actuals,
                      fiscalYearContaining(today),
                    )}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>De minimis indirect costs</CardTitle>
                  <CardDescription>
                    A calculator for the 15% rate. Nothing here is saved.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DeMinimisCalculator currency={grant.currency} />
                </CardContent>
              </Card>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Budget versus actual</CardTitle>
              <CardDescription>
                The approved budget by category, and what has been spent against it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BudgetSection
                grantId={grant.id}
                awardId={award.id}
                currency={grant.currency}
                lines={data.budgetLines}
                actuals={data.actuals}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reimbursements</CardTitle>
              <CardDescription>
                Invoices and drawdown requests sent to the funder, and how long they have been
                outstanding.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Reimbursements
                grantId={grant.id}
                awardId={award.id}
                currency={grant.currency}
                rows={data.reimbursements}
                today={today}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance checklist</CardTitle>
              <CardDescription>
                {award.is_federal
                  ? "The federal checklist for this award."
                  : "The checklist for this award."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Checklist
                grantId={grant.id}
                awardId={award.id}
                isFederal={award.is_federal}
                items={data.items}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Close-out</CardTitle>
              <CardDescription>The last step, once the final reports are in.</CardDescription>
            </CardHeader>
            <CardContent>
              <CloseoutCard
                grantId={grant.id}
                award={award}
                reports={data.reports}
                items={data.items}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
