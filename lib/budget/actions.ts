"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/lib/auth/actions";
import { awardPath, requireEditableGrant } from "@/lib/compliance/access";
import { parseIsoDate } from "@/lib/compliance/dates";
import type { TablesInsert } from "@/lib/db/types";
import { parseActualsCsv } from "./csv";
import { toNumber, roundMoney } from "./money";

/** Server actions for budget lines and actuals. Same rules as lib/compliance/actions.ts. */

const MAX_CSV_BYTES = 2 * 1024 * 1024;

function text(formData: FormData, field: string, max = 1000): string | null {
  const value = String(formData.get(field) ?? "")
    .replace(/\s+/g, " ")
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
}

export async function addBudgetLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const awardId = id(formData, "awardId");
  if (!grantId || !awardId) return error("This award could not be found.");
  const category = text(formData, "category", 200);
  if (!category) return error("Name the budget category.");
  const budgetedText = text(formData, "budgeted", 40);
  const budgeted = budgetedText === null ? null : toNumber(budgetedText.replace(/[^0-9.]/g, ""));
  if (budgetedText !== null && (budgeted === null || budgeted < 0)) {
    return error("Enter the budgeted amount as a number, or leave it blank if it is not known.");
  }
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const row: TablesInsert<"budget_lines"> = {
    organization_id: access.organizationId,
    award_id: awardId,
    category,
    budgeted: budgeted === null ? null : roundMoney(budgeted),
    sort_order: Math.floor(toNumber(text(formData, "sortOrder", 5)) ?? 0),
    created_by: access.user.id,
  };
  const { error: insertError } = await access.supabase.from("budget_lines").insert(row);
  if (insertError) {
    if (insertError.code === "23505") return error("That category is already in the budget.");
    console.error("addBudgetLine failed", insertError.message);
    return error("We could not add the budget line. Try again.");
  }
  refresh(grantId);
  return ok("Budget line added.");
}

export async function updateBudgetLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const lineId = id(formData, "lineId");
  if (!grantId || !lineId) return error("This budget line could not be found.");
  const budgetedText = text(formData, "budgeted", 40);
  const budgeted = budgetedText === null ? null : toNumber(budgetedText.replace(/[^0-9.]/g, ""));
  if (budgetedText !== null && (budgeted === null || budgeted < 0)) {
    return error("Enter the budgeted amount as a number, or leave it blank if it is not known.");
  }
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const { data, error: updateError } = await access.supabase
    .from("budget_lines")
    .update({ budgeted: budgeted === null ? null : roundMoney(budgeted) })
    .eq("id", lineId)
    .select("id");
  if (updateError) return error("We could not save the budget line. Try again.");
  if (!data?.length) return error("This budget line could not be found.");
  refresh(grantId);
  return ok("Saved.");
}

export async function deleteBudgetLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const lineId = id(formData, "lineId");
  if (!grantId || !lineId) return error("This budget line could not be found.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const { error: deleteError } = await access.supabase
    .from("budget_lines")
    .delete()
    .eq("id", lineId);
  if (deleteError) return error("We could not remove the budget line. Try again.");
  refresh(grantId);
  return ok("Budget line and its actuals removed.");
}

export async function addActual(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const awardId = id(formData, "awardId");
  const lineId = id(formData, "lineId");
  if (!grantId || !awardId) return error("This award could not be found.");
  if (!lineId) return error("Choose a budget line.");
  const spentOn = parseIsoDate(text(formData, "spentOn", 10));
  if (!spentOn) return error("Enter the date it was spent.");
  const amount = toNumber((text(formData, "amount", 40) ?? "").replace(/[^0-9.-]/g, ""));
  if (amount === null) return error("Enter the amount as a number.");
  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const row: TablesInsert<"budget_actuals"> = {
    organization_id: access.organizationId,
    award_id: awardId,
    budget_line_id: lineId,
    spent_on: spentOn,
    amount: roundMoney(amount),
    description: text(formData, "description", 1000),
    source: "manual",
    created_by: access.user.id,
  };
  const { error: insertError } = await access.supabase.from("budget_actuals").insert(row);
  if (insertError) {
    console.error("addActual failed", insertError.message);
    return error("We could not record the spending. Try again.");
  }
  refresh(grantId);
  return ok("Spending recorded.");
}

/**
 * Import actuals from a CSV export of the books. Categories that match a budget line (ignoring
 * case) go onto it; the rest become new lines with no budgeted amount ("Not available") so nothing
 * is silently dropped. Rows that cannot be read are listed and skipped.
 */
export async function importActualsCsv(_prev: FormState, formData: FormData): Promise<FormState> {
  const grantId = id(formData, "grantId");
  const awardId = id(formData, "awardId");
  if (!grantId || !awardId) return error("This award could not be found.");

  const file = formData.get("file");
  let csv = "";
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV_BYTES)
      return error("The file is larger than 2 MB. Split it and try again.");
    csv = await file.text();
  } else {
    csv = String(formData.get("pasted") ?? "");
  }
  if (!csv.trim()) return error("Choose a CSV file or paste rows first.");
  const parsed = parseActualsCsv(csv);
  if (parsed.rows.length === 0) {
    return error(parsed.problems[0] ?? "No rows could be read from the file.");
  }

  const access = await requireEditableGrant(grantId);
  if (!access.ok) return access.state;
  const { supabase, organizationId, user } = access;

  const existing = await supabase
    .from("budget_lines")
    .select("id, category")
    .eq("award_id", awardId);
  if (existing.error) return error("We could not read the budget. Try again.");
  const lineByCategory = new Map<string, string>();
  for (const line of (existing.data ?? []) as Array<{ id: string; category: string }>) {
    lineByCategory.set(line.category.trim().toLowerCase(), line.id);
  }

  const newCategories = [...new Set(parsed.rows.map((r) => r.category.trim().toLowerCase()))]
    .filter((key) => !lineByCategory.has(key))
    .map((key) => parsed.rows.find((r) => r.category.trim().toLowerCase() === key)!.category);
  if (newCategories.length > 0) {
    const lines: TablesInsert<"budget_lines">[] = newCategories.map((category) => ({
      organization_id: organizationId,
      award_id: awardId,
      category,
      budgeted: null,
      sort_order: 500,
      created_by: user.id,
    }));
    const created = await supabase.from("budget_lines").insert(lines).select("id, category");
    if (created.error) {
      console.error("importActualsCsv line insert failed", created.error.message);
      return error("We could not create the new budget lines. Try again.");
    }
    for (const line of (created.data ?? []) as Array<{ id: string; category: string }>) {
      lineByCategory.set(line.category.trim().toLowerCase(), line.id);
    }
  }

  const rows: TablesInsert<"budget_actuals">[] = parsed.rows.map((r) => ({
    organization_id: organizationId,
    award_id: awardId,
    budget_line_id: lineByCategory.get(r.category.trim().toLowerCase())!,
    spent_on: r.spentOn,
    amount: roundMoney(r.amount),
    description: r.description,
    source: "csv",
    created_by: user.id,
  }));
  const { error: insertError } = await supabase.from("budget_actuals").insert(rows);
  if (insertError) {
    console.error("importActualsCsv insert failed", insertError.message);
    return error("We could not save the imported rows. Nothing was imported. Try again.");
  }

  refresh(grantId);
  const parts = [
    `Imported ${rows.length} row${rows.length === 1 ? "" : "s"}.`,
    newCategories.length > 0
      ? `${newCategories.length} new budget line${newCategories.length === 1 ? "" : "s"} created without a budgeted amount: ${newCategories.join(", ")}.`
      : null,
    parsed.problems.length > 0
      ? `Skipped ${parsed.problems.length}: ${parsed.problems.slice(0, 5).join(" ")}${parsed.problems.length > 5 ? " …" : ""}`
      : null,
  ].filter(Boolean);
  return ok(parts.join(" "));
}
