import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Tables } from "@/lib/db/types";
import { type GrantForAward, findGrant } from "./access";
import type { FederalActual, FederalAwardAmount } from "./single-audit";

/**
 * Reads for the award page. Every query runs as the signed-in person, so row-level security
 * decides what comes back; the organization filter is belt and braces.
 */

export type AwardRow = Tables<"awards">;
export type AwardReportRow = Tables<"award_reports">;
export type BudgetLineRow = Tables<"budget_lines">;
export type BudgetActualRow = Tables<"budget_actuals">;
export type ReimbursementRow = Tables<"reimbursements">;
export type ComplianceItemRow = Tables<"compliance_items">;

export interface AwardPageData {
  grant: GrantForAward;
  funderName: string | null;
  award: AwardRow | null;
  reports: AwardReportRow[];
  budgetLines: BudgetLineRow[];
  actuals: BudgetActualRow[];
  reimbursements: ReimbursementRow[];
  items: ComplianceItemRow[];
  /** Every federal award in the organization, for the single-audit check. */
  federal: { awards: FederalAwardAmount[]; actuals: FederalActual[] };
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}: ${error?.message ?? "unknown error"}`);
}

export async function findAward(
  supabase: SupabaseClient,
  grantId: string,
): Promise<AwardRow | null> {
  const { data, error } = await supabase
    .from("awards")
    .select("*")
    .eq("grant_id", grantId)
    .maybeSingle();
  if (error) fail("the award", error);
  return (data as AwardRow | null) ?? null;
}

export async function listReports(
  supabase: SupabaseClient,
  awardId: string,
): Promise<AwardReportRow[]> {
  const { data, error } = await supabase
    .from("award_reports")
    .select("*")
    .eq("award_id", awardId)
    .order("due_date")
    .order("kind");
  if (error) fail("the report schedule", error);
  return (data ?? []) as AwardReportRow[];
}

/** Federal awards across the organization, with the amount and period from their grants. */
export async function listFederalAwards(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ awards: FederalAwardAmount[]; actuals: FederalActual[] }> {
  const { data, error } = await supabase
    .from("awards")
    .select("id, grants(amount_awarded, award_start_date, award_end_date)")
    .eq("organization_id", organizationId)
    .eq("is_federal", true);
  if (error) fail("the federal awards", error);
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    grants: {
      amount_awarded: string | number | null;
      award_start_date: string | null;
      award_end_date: string | null;
    } | null;
  }>;
  const awards: FederalAwardAmount[] = rows.map((row) => ({
    amount: row.grants?.amount_awarded == null ? null : Number(row.grants.amount_awarded),
    periodStart: row.grants?.award_start_date ?? null,
    periodEnd: row.grants?.award_end_date ?? null,
  }));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return { awards, actuals: [] };
  const spent = await supabase
    .from("budget_actuals")
    .select("spent_on, amount")
    .eq("organization_id", organizationId)
    .in("award_id", ids);
  if (spent.error) fail("the federal spending", spent.error);
  const actuals: FederalActual[] = (
    (spent.data ?? []) as Array<{
      spent_on: string;
      amount: string | number;
    }>
  ).map((row) => ({ spentOn: row.spent_on, amount: Number(row.amount) }));
  return { awards, actuals };
}

export async function loadAwardPage(
  supabase: SupabaseClient,
  organizationId: string,
  grantId: string,
): Promise<AwardPageData | null> {
  const grant = await findGrant(supabase, grantId);
  if (!grant || grant.organization_id !== organizationId) return null;

  const [funder, award, federal] = await Promise.all([
    grant.funder_id
      ? supabase.from("funders").select("name").eq("id", grant.funder_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    findAward(supabase, grantId),
    listFederalAwards(supabase, organizationId),
  ]);
  if (funder.error) fail("the funder", funder.error);
  const funderName = (funder.data as { name: string } | null)?.name ?? null;

  if (!award) {
    return {
      grant,
      funderName,
      award: null,
      reports: [],
      budgetLines: [],
      actuals: [],
      reimbursements: [],
      items: [],
      federal,
    };
  }

  const [reports, lines, actuals, reimbursements, items] = await Promise.all([
    listReports(supabase, award.id),
    supabase
      .from("budget_lines")
      .select("*")
      .eq("award_id", award.id)
      .order("sort_order")
      .order("category"),
    supabase
      .from("budget_actuals")
      .select("*")
      .eq("award_id", award.id)
      .order("spent_on", { ascending: false }),
    supabase
      .from("reimbursements")
      .select("*")
      .eq("award_id", award.id)
      .order("sent_on", { ascending: false, nullsFirst: true }),
    supabase
      .from("compliance_items")
      .select("*")
      .eq("award_id", award.id)
      .order("sort_order")
      .order("created_at"),
  ]);
  if (lines.error) fail("the budget", lines.error);
  if (actuals.error) fail("the actuals", actuals.error);
  if (reimbursements.error) fail("the reimbursements", reimbursements.error);
  if (items.error) fail("the checklist", items.error);

  return {
    grant,
    funderName,
    award,
    reports,
    budgetLines: (lines.data ?? []) as BudgetLineRow[],
    actuals: (actuals.data ?? []) as BudgetActualRow[],
    reimbursements: (reimbursements.data ?? []) as ReimbursementRow[],
    items: (items.data ?? []) as ComplianceItemRow[],
    federal,
  };
}
