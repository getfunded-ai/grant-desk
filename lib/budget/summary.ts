/**
 * Budget versus actual, one row per budget line plus a total. Remaining is computed only where the
 * budgeted amount is known; otherwise it reads "Not available". Pure module.
 */

import { type MoneyInput, sumKnown, toNumber } from "./money";

export interface BudgetLineInput {
  id: string;
  category: string;
  budgeted: MoneyInput;
  sortOrder: number;
}

export interface ActualInput {
  budgetLineId: string;
  amount: MoneyInput;
}

export interface BudgetRow {
  id: string;
  category: string;
  budgeted: number | null;
  actual: number;
  /** budgeted − actual; null when the budget is not known. */
  remaining: number | null;
  /** actual ÷ budgeted; null when the budget is not known or zero. */
  spentShare: number | null;
}

export interface BudgetSummary {
  rows: BudgetRow[];
  totalBudgeted: number | null;
  totalActual: number;
  totalRemaining: number | null;
  /** Lines whose budget is not known, so the total budget is a partial figure. */
  linesWithoutBudget: number;
}

export function budgetVersusActual(
  lines: BudgetLineInput[],
  actuals: ActualInput[],
): BudgetSummary {
  const spent = new Map<string, number>();
  for (const actual of actuals) {
    const amount = toNumber(actual.amount) ?? 0;
    spent.set(actual.budgetLineId, (spent.get(actual.budgetLineId) ?? 0) + amount);
  }
  const rows: BudgetRow[] = [...lines]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.category.localeCompare(b.category))
    .map((line) => {
      const budgeted = toNumber(line.budgeted);
      const actual = round2(spent.get(line.id) ?? 0);
      return {
        id: line.id,
        category: line.category,
        budgeted,
        actual,
        remaining: budgeted === null ? null : round2(budgeted - actual),
        spentShare: budgeted === null || budgeted === 0 ? null : actual / budgeted,
      };
    });
  const totalBudgeted = sumKnown(rows.map((r) => r.budgeted));
  const totalActual = round2(rows.reduce((sum, r) => sum + r.actual, 0));
  return {
    rows,
    totalBudgeted,
    totalActual,
    totalRemaining: totalBudgeted === null ? null : round2(totalBudgeted - totalActual),
    linesWithoutBudget: rows.filter((r) => r.budgeted === null).length,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
