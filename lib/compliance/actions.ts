"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/lib/auth/actions";
import { toNumber, roundMoney } from "@/lib/budget/money";
import type { Enums, TablesInsert } from "@/lib/db/types";
import { type GrantAccess, awardPath, requireEditableGrant } from "./access";
import { checklistTemplate } from "./checklist";
import { type IsoDate, addYears, parseIsoDate, todayIso } from "./dates";
import { RECORD_RETENTION_YEARS } from "./rules";
import { type ReportFrequency, generateReportSchedule } from "./schedule";
import { type AwardReportRow, findAward, listReports } from "./store";

/**
 * Server actions for the award page. Each one checks the signed-in person and their role, then
 * writes with that person's own client so row-level security applies. Every write is a person's
 * decision: nothing here is called by AI or an agent (AGENTS.md honesty rule 3).
 */

type Write = Extract<GrantAccess, { ok: true }>;

const PAYMENT_METHODS = new Set(["reimbursement", "advance", "lump_sum", "other"]);
const INDIRECT_METHODS = new Set(["de_minimis", "negotiated_rate", "none", "other"]);
const FREQUENCIES = new Set<ReportFrequency>(["quarterly", "semiannual", "annual", "none"]);
const REPORT_KINDS = new Set([
  "financial",
  "performance",
  "final_financial",
  "final_performance",
  "other",
]);

function text(formData: FormData, field: string, max = 1000): string | null {
  const value = String(formData.get(field) ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function id(formData: FormData, field: string): string | null {
  const value = String(formData.get(field) ?? "").trim();
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function error(message: string): FormState {
  return { status: "error", message };
}

function ok(message: string): FormState {
  return { status: "success", message };
}

function refresh(grantId: string) {
  revalidatePath(awardPath(grantId));
  revalidatePath(`/grants/${grantId}`);
  revalidatePath("/calendar");
}

async function log(
  access: Write,
  action: string,
  summary: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const row: TablesInsert<"activity_log"> = {
    organization_id: access.organizationId,
    grant_id: access.grant.id,
    actor_kind: "person",
    actor_id: access.user.id,
    action,
    summary,
    details: details as TablesInsert<"activity_log">["details"],
  };
  const { error: logError } = await access.supabase.from("activity_log").insert(row);
  // A missing log line must not undo the change; say so in the server log instead.
  if (logError) console.error("activity_log insert failed", { action, message: logError.message });
}

/**
 * Replaces the generated reports that are still due with a fresh schedule, keeps the ones a person
 * typed or already submitted, and relies on the database trigger to keep the calendar in step.
 */
async function regenerate(access: Write, awardId: string): Promise<number> {
  const { grant, supabase } = access;
  const award = await findAward(supabase, grant.id);
  if (!award) return 0;
  if (!grant.award_start_date || !grant.award_end_date) return 0;

  const wanted = generateReportSchedule({
    periodStart: grant.award_start_date,
    periodEnd: grant.award_end_date,
    frequency: award.report_frequency,
    isFederal: award.is_federal,
    reportLagDays: award.report_lag_days,
    finalReportLagDays: award.final_report_lag_days,
  });

  const existing = await listReports(supabase, awardId);
  const stale = existing.filter((r) => r.generated && r.status === "due");
  if (stale.length > 0) {
    const { error: deleteError } = await supabase
      .from("award_reports")
      .delete()
      .in(
        "id",
        stale.map((r) => r.id),
      );
    if (deleteError) throw new Error(`Could not clear the old schedule: ${deleteError.message}`);
  }
  const kept = new Set(
    existing
      .filter((r) => !(r.generated && r.status === "due"))
      .map((r) => `${r.kind}|${r.due_date}`),
  );
  const rows: TablesInsert<"award_reports">[] = wanted
    .filter((r) => !kept.has(`${r.kind}|${r.dueDate}`))
    .map((r) => ({
      organization_id: access.organizationId,
      award_id: awardId,
      kind: r.kind,
      title: r.title,
      period_start: r.periodStart,
      period_end: r.periodEnd,
      due_date: r.dueDate,
      generated: true,
      created_by: access.user.id,
    }));
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("award_reports").insert(rows);
    if (insertError) throw new Error(`Could not write the schedule: ${insertError.message}`);
  }
  return rows.length;
}

/** Award terms: amount and period (on the grant), the rest on the award row. */
export async function saveAwardTerms(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  if (!grantId) return error("This grant could not be found.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const { supabase, grant, user, organizationId } = access;

  const amountText = text(formData, "amountAwarded", 40);
  const amount = amountText === null ? null : toNumber(amountText.replace(/[^0-9.]/g, ""));
  if (amountText !== null && (amount === null || amount < 0)) {
    return error("Enter the amount awarded as a number, or leave it blank if it is not known.");
  }
  const startText = text(formData, "periodStart", 10);
  const endText = text(formData, "periodEnd", 10);
  const periodStart = startText === null ? null : parseIsoDate(startText);
  const periodEnd = endText === null ? null : parseIsoDate(endText);
  if ((startText && !periodStart) || (endText && !periodEnd)) {
    return error("Enter the period of performance as dates.");
  }
  if (periodStart && periodEnd && periodStart > periodEnd) {
    return error("The period of performance must start before it ends.");
  }

  const isFederal = formData.get("isFederal") === "on";
  const paymentMethod = text(formData, "paymentMethod", 40);
  if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod))
    return error("Choose a payment method.");
  const indirectMethod = text(formData, "indirectMethod", 40);
  if (indirectMethod && !INDIRECT_METHODS.has(indirectMethod)) {
    return error("Choose an indirect cost method.");
  }
  const rateText = text(formData, "indirectRate", 20);
  const indirectRate = rateText === null ? null : toNumber(rateText.replace(/[^0-9.]/g, ""));
  if (rateText !== null && (indirectRate === null || indirectRate < 0 || indirectRate > 100)) {
    return error("Enter the indirect rate as a percentage between 0 and 100.");
  }
  if (indirectRate !== null && indirectMethod !== "negotiated_rate" && indirectMethod !== "other") {
    return error(
      "A rate goes with a negotiated rate (or other). The de minimis rate is fixed at 15 percent.",
    );
  }
  const frequency = (text(formData, "reportFrequency", 20) ?? "quarterly") as ReportFrequency;
  if (!FREQUENCIES.has(frequency)) return error("Choose how often reports are due.");
  const reportLagDays = Math.floor(toNumber(text(formData, "reportLagDays", 5)) ?? 30);
  const finalReportLagDays = Math.floor(toNumber(text(formData, "finalReportLagDays", 5)) ?? 60);
  if (
    reportLagDays < 0 ||
    reportLagDays > 365 ||
    finalReportLagDays < 0 ||
    finalReportLagDays > 365
  ) {
    return error("Days after a period must be between 0 and 365.");
  }

  const grantUpdate = await supabase
    .from("grants")
    .update({
      amount_awarded: amount === null ? null : roundMoney(amount),
      award_start_date: periodStart,
      award_end_date: periodEnd,
    })
    .eq("id", grant.id)
    .select("id");
  if (grantUpdate.error || !grantUpdate.data?.length) {
    console.error("saveAwardTerms grant update failed", grantUpdate.error?.message);
    return error("We could not save the amount and dates. Try again.");
  }

  const existing = await findAward(supabase, grant.id);
  const terms = {
    is_federal: isFederal,
    award_number: text(formData, "awardNumber", 100),
    payment_method: paymentMethod as Enums<"award_payment_method"> | null,
    indirect_method: indirectMethod as Enums<"indirect_cost_method"> | null,
    indirect_rate: indirectRate === null ? null : Math.round(indirectRate * 1000) / 1000,
    report_frequency: frequency,
    report_lag_days: reportLagDays,
    final_report_lag_days: finalReportLagDays,
    notes: text(formData, "notes", 4000),
  };
  let awardId: string;
  if (existing) {
    const { error: updateError } = await supabase
      .from("awards")
      .update(terms)
      .eq("id", existing.id);
    if (updateError) {
      console.error("saveAwardTerms award update failed", updateError.message);
      return error("We could not save the award terms. Try again.");
    }
    awardId = existing.id;
  } else {
    const insert: TablesInsert<"awards"> = {
      ...terms,
      organization_id: organizationId,
      grant_id: grant.id,
      created_by: user.id,
    };
    const { data, error: insertError } = await supabase
      .from("awards")
      .insert(insert)
      .select("id")
      .single();
    if (insertError || !data) {
      console.error("saveAwardTerms award insert failed", insertError?.message);
      return error("We could not save the award terms. Try again.");
    }
    awardId = (data as { id: string }).id;
    const items: TablesInsert<"compliance_items">[] = checklistTemplate(isFederal).map(
      (item, index) => ({
        organization_id: organizationId,
        award_id: awardId,
        template_key: item.key,
        title: item.title,
        detail: item.detail,
        sort_order: (index + 1) * 10,
        created_by: user.id,
      }),
    );
    const { error: itemsError } = await supabase.from("compliance_items").insert(items);
    if (itemsError) console.error("checklist template insert failed", itemsError.message);
  }

  // The access object still holds the grant as it was; refresh the dates for the generator.
  const fresh: Write = {
    ...access,
    grant: {
      ...grant,
      amount_awarded: amount,
      award_start_date: periodStart,
      award_end_date: periodEnd,
    },
  };
  let generated = 0;
  try {
    generated = await regenerate(fresh, awardId);
  } catch (regenError) {
    console.error("saveAwardTerms schedule failed", regenError);
    await log(
      fresh,
      "award.terms_saved",
      "Award terms saved; the report schedule could not be generated.",
    );
    refresh(grant.id);
    return error(
      "The terms were saved, but the report schedule could not be generated. Try the Regenerate button.",
    );
  }
  await log(fresh, "award.terms_saved", existing ? "Award terms updated." : "Award entered.", {
    is_federal: isFederal,
    reports_generated: generated,
  });
  refresh(grant.id);
  if (!periodStart || !periodEnd) {
    return ok("Saved. Add the period of performance to generate the report schedule.");
  }
  return ok(
    generated > 0
      ? `Saved. ${generated} report date${generated === 1 ? "" : "s"} added to the calendar.`
      : "Saved. The report schedule is up to date.",
  );
}

export async function regenerateSchedule(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const awardId = id(formData, "awardId");
  if (!grantId || !awardId) return error("This award could not be found.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  if (!access.grant.award_start_date || !access.grant.award_end_date) {
    return error("Add the period of performance first.");
  }
  try {
    const generated = await regenerate(access, awardId);
    await log(access, "award.schedule_regenerated", "Report schedule regenerated.", {
      reports_generated: generated,
    });
  } catch (regenError) {
    console.error("regenerateSchedule failed", regenError);
    return error("We could not regenerate the schedule. Try again.");
  }
  refresh(grantId);
  return ok(
    "The report schedule was regenerated. Submitted reports and reports you added were kept.",
  );
}

export async function addReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const awardId = id(formData, "awardId");
  if (!grantId || !awardId) return error("This award could not be found.");
  const title = text(formData, "title", 500);
  const dueDate = parseIsoDate(text(formData, "dueDate", 10));
  const kind = text(formData, "kind", 30) ?? "other";
  if (!title) return error("Give the report a title.");
  if (!dueDate) return error("Enter the due date.");
  if (!REPORT_KINDS.has(kind)) return error("Choose a report type.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const row: TablesInsert<"award_reports"> = {
    organization_id: access.organizationId,
    award_id: awardId,
    kind: kind as Enums<"award_report_kind">,
    title,
    due_date: dueDate,
    generated: false,
    created_by: access.user.id,
  };
  const { error: insertError } = await access.supabase.from("award_reports").insert(row);
  if (insertError) {
    console.error("addReport failed", insertError.message);
    return error("We could not add the report. Try again.");
  }
  await log(access, "award.report_added", `Report added: ${title}, due ${dueDate}.`);
  refresh(grantId);
  return ok("Report added to the schedule and the calendar.");
}

const SUBMITTED_TAG = " (submitted)";

/** Adds or removes the tag that tells the calendar a report went out. */
function withSubmittedTag(title: string, submitted: boolean): string {
  const bare = title.endsWith(SUBMITTED_TAG) ? title.slice(0, -SUBMITTED_TAG.length) : title;
  const tagged = submitted ? `${bare}${SUBMITTED_TAG}` : bare;
  return tagged.length > 500 ? bare : tagged;
}

async function findReport(access: Write, reportId: string): Promise<AwardReportRow | null> {
  const { data } = await access.supabase
    .from("award_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  return (data as AwardReportRow | null) ?? null;
}

/** A person records that a report went out, with the date it was sent. */
export async function markReportSubmitted(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const reportId = id(formData, "reportId");
  if (!grantId || !reportId) return error("This report could not be found.");
  const submittedOn = parseIsoDate(text(formData, "submittedOn", 10) ?? todayIso());
  if (!submittedOn) return error("Enter the date the report was sent.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const report = await findReport(access, reportId);
  if (!report) return error("This report could not be found.");
  // The title change carries "(submitted)" onto the calendar entry through the sync trigger.
  const { error: updateError } = await access.supabase
    .from("award_reports")
    .update({
      status: "submitted",
      submitted_on: submittedOn,
      title: withSubmittedTag(report.title, true),
    })
    .eq("id", reportId);
  if (updateError) {
    console.error("markReportSubmitted failed", updateError.message);
    return error("We could not mark the report submitted. Try again.");
  }
  await log(
    access,
    "award.report_submitted",
    `${report.title} marked submitted on ${submittedOn}.`,
  );
  refresh(grantId);
  return ok("Marked submitted.");
}

export async function reopenReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const reportId = id(formData, "reportId");
  if (!grantId || !reportId) return error("This report could not be found.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const report = await findReport(access, reportId);
  if (!report) return error("This report could not be found.");
  const { error: updateError } = await access.supabase
    .from("award_reports")
    .update({ status: "due", submitted_on: null, title: withSubmittedTag(report.title, false) })
    .eq("id", reportId);
  if (updateError) return error("We could not reopen the report. Try again.");
  await log(access, "award.report_reopened", "A report was marked due again.");
  refresh(grantId);
  return ok("The report is due again.");
}

export async function deleteReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const reportId = id(formData, "reportId");
  if (!grantId || !reportId) return error("This report could not be found.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const report = await findReport(access, reportId);
  if (!report) return error("This report could not be found.");
  const { error: deleteError } = await access.supabase
    .from("award_reports")
    .delete()
    .eq("id", reportId);
  if (deleteError) return error("We could not remove the report. Try again.");
  await log(access, "award.report_removed", `Report removed: ${report.title}.`);
  refresh(grantId);
  return ok("Report removed from the schedule and the calendar.");
}

export async function toggleChecklistItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const itemId = id(formData, "itemId");
  if (!grantId || !itemId) return error("This item could not be found.");
  const done = formData.get("done") === "1";
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const { error: updateError } = await access.supabase
    .from("compliance_items")
    .update(
      done
        ? { completed_at: new Date().toISOString(), completed_by: access.user.id }
        : { completed_at: null, completed_by: null },
    )
    .eq("id", itemId);
  if (updateError) return error("We could not update the checklist. Try again.");
  refresh(grantId);
  return ok(done ? "Done." : "Reopened.");
}

export async function addChecklistItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const awardId = id(formData, "awardId");
  if (!grantId || !awardId) return error("This award could not be found.");
  const title = text(formData, "title", 500);
  if (!title) return error("Write what needs doing.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const row: TablesInsert<"compliance_items"> = {
    organization_id: access.organizationId,
    award_id: awardId,
    title,
    detail: text(formData, "detail", 2000),
    sort_order: 1000,
    created_by: access.user.id,
  };
  const { error: insertError } = await access.supabase.from("compliance_items").insert(row);
  if (insertError) return error("We could not add the item. Try again.");
  refresh(grantId);
  return ok("Added to the checklist.");
}

export async function addReimbursement(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const awardId = id(formData, "awardId");
  if (!grantId || !awardId) return error("This award could not be found.");
  const amountText = text(formData, "amount", 40);
  const amount = amountText === null ? null : toNumber(amountText.replace(/[^0-9.]/g, ""));
  if (amountText !== null && (amount === null || amount < 0)) {
    return error("Enter the amount as a number, or leave it blank.");
  }
  const sentText = text(formData, "sentOn", 10);
  const paidText = text(formData, "paidOn", 10);
  const sentOn = sentText ? parseIsoDate(sentText) : null;
  const paidOn = paidText ? parseIsoDate(paidText) : null;
  if ((sentText && !sentOn) || (paidText && !paidOn)) return error("Enter the dates as dates.");
  if (sentOn && paidOn && paidOn < sentOn) return error("Paid on cannot be before sent on.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const row: TablesInsert<"reimbursements"> = {
    organization_id: access.organizationId,
    award_id: awardId,
    invoice_number: text(formData, "invoiceNumber", 100),
    amount: amount === null ? null : roundMoney(amount),
    sent_on: sentOn,
    paid_on: paidOn,
    notes: text(formData, "notes", 2000),
    created_by: access.user.id,
  };
  const { error: insertError } = await access.supabase.from("reimbursements").insert(row);
  if (insertError) {
    console.error("addReimbursement failed", insertError.message);
    return error("We could not add the invoice. Try again.");
  }
  await log(access, "award.reimbursement_added", "Reimbursement request recorded.");
  refresh(grantId);
  return ok("Invoice recorded.");
}

export async function markReimbursementPaid(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const reimbursementId = id(formData, "reimbursementId");
  if (!grantId || !reimbursementId) return error("This invoice could not be found.");
  const paidOn = parseIsoDate(text(formData, "paidOn", 10) ?? todayIso());
  if (!paidOn) return error("Enter the date it was paid.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const { data, error: updateError } = await access.supabase
    .from("reimbursements")
    .update({ paid_on: paidOn })
    .eq("id", reimbursementId)
    .select("id");
  if (updateError) {
    const beforeSent = updateError.message.includes("reimbursements_paid_after_sent");
    return error(
      beforeSent
        ? "Paid on cannot be before sent on."
        : "We could not record the payment. Try again.",
    );
  }
  if (!data?.length) return error("This invoice could not be found.");
  await log(access, "award.reimbursement_paid", `Reimbursement paid on ${paidOn}.`);
  refresh(grantId);
  return ok("Marked paid.");
}

export async function deleteReimbursement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const reimbursementId = id(formData, "reimbursementId");
  if (!grantId || !reimbursementId) return error("This invoice could not be found.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const { error: deleteError } = await access.supabase
    .from("reimbursements")
    .delete()
    .eq("id", reimbursementId);
  if (deleteError) return error("We could not remove the invoice. Try again.");
  refresh(grantId);
  return ok("Invoice removed.");
}

/**
 * Close-out (2 CFR 200.344): a person confirms the award is finished. Records the date, sets the
 * record-retention end date from the final financial report's submitted date (200.334), and moves
 * the grant to the closed stage. Nothing is deleted.
 */
export async function closeOutAward(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const awardId = id(formData, "awardId");
  if (!grantId || !awardId) return error("This award could not be found.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const { supabase, user } = access;
  const award = await findAward(supabase, grantId);
  if (!award || award.id !== awardId) return error("This award could not be found.");
  if (award.closed_at) return error("This award is already closed out.");

  const reports = await listReports(supabase, awardId);
  const finalFinancial = reports.find(
    (r) =>
      r.kind === (award.is_federal ? "final_financial" : "final_performance") && r.status !== "due",
  );
  const retentionUntil: IsoDate | null = finalFinancial?.submitted_on
    ? addYears(finalFinancial.submitted_on, RECORD_RETENTION_YEARS)
    : null;

  const { error: closeError } = await supabase
    .from("awards")
    .update({
      closed_at: new Date().toISOString(),
      closed_by: user.id,
      records_retention_until: retentionUntil,
    })
    .eq("id", awardId);
  if (closeError) {
    console.error("closeOutAward failed", closeError.message);
    return error("We could not close out the award. Try again.");
  }
  const stage = await supabase
    .from("grants")
    .update({ stage: "closed" })
    .eq("id", grantId)
    .select("id");
  if (stage.error) console.error("closeOutAward stage change failed", stage.error.message);
  await log(access, "award.closed_out", "Award closed out by a person.", {
    records_retention_until: retentionUntil,
    stage_moved: !stage.error,
  });
  refresh(grantId);
  return ok(
    retentionUntil
      ? `Closed out. Keep the records until ${retentionUntil}.`
      : "Closed out. The record-retention date is not available because the final report has no submitted date.",
  );
}
