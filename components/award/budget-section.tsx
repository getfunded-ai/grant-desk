import { deleteBudgetLine, updateBudgetLine } from "@/lib/budget/actions";
import { formatMoney } from "@/lib/budget/money";
import { budgetVersusActual } from "@/lib/budget/summary";
import { formatDate } from "@/lib/compliance/dates";
import type { BudgetActualRow, BudgetLineRow } from "@/lib/compliance/store";
import { ActionForm } from "./action-form";
import { AddActualForm, AddBudgetLineForm, CsvImportForm } from "./small-forms";

export function BudgetSection({
  grantId,
  awardId,
  currency,
  lines,
  actuals,
  canEdit,
}: {
  grantId: string;
  awardId: string;
  currency: string;
  lines: BudgetLineRow[];
  actuals: BudgetActualRow[];
  canEdit: boolean;
}) {
  const summary = budgetVersusActual(
    lines.map((l) => ({
      id: l.id,
      category: l.category,
      budgeted: l.budgeted,
      sortOrder: l.sort_order,
    })),
    actuals.map((a) => ({ budgetLineId: a.budget_line_id, amount: a.amount })),
  );
  const ids = { grantId, awardId };
  const recent = actuals.slice(0, 10);
  const lineName = new Map(lines.map((l) => [l.id, l.category]));

  return (
    <div className="space-y-6">
      {summary.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No budget lines yet. Add the approved budget’s categories, then record spending or import
          it from the books.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Category</th>
                <th className="py-1 pr-3 text-right font-medium">Budgeted</th>
                <th className="py-1 pr-3 text-right font-medium">Actual</th>
                <th className="py-1 pr-3 text-right font-medium">Remaining</th>
                <th className="py-1 pr-3 text-right font-medium">Spent</th>
                {canEdit ? <th className="py-1 font-medium" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-3">{row.category}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {formatMoney(row.budgeted, currency)}
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {formatMoney(row.actual, currency)}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right whitespace-nowrap ${
                      row.remaining !== null && row.remaining < 0
                        ? "text-destructive font-medium"
                        : ""
                    }`}
                  >
                    {formatMoney(row.remaining, currency)}
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap text-muted-foreground">
                    {row.spentShare === null
                      ? "Not available"
                      : `${Math.round(row.spentShare * 100)}%`}
                  </td>
                  {canEdit ? (
                    <td className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionForm
                          action={updateBudgetLine}
                          fields={{ grantId, lineId: row.id }}
                          label="Save"
                          size="xs"
                          variant="ghost"
                        >
                          <input
                            name="budgeted"
                            inputMode="decimal"
                            defaultValue={row.budgeted ?? ""}
                            placeholder="Budgeted"
                            aria-label={`Budgeted amount for ${row.category}`}
                            className="h-6 w-28 rounded-md border border-input bg-transparent px-1 text-xs"
                          />
                        </ActionForm>
                        <ActionForm
                          action={deleteBudgetLine}
                          fields={{ grantId, lineId: row.id }}
                          label="Remove"
                          size="xs"
                          variant="ghost"
                          confirm={`Remove the ${row.category} line and everything recorded against it?`}
                        />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t font-medium">
              <tr>
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 pr-3 text-right whitespace-nowrap">
                  {formatMoney(summary.totalBudgeted, currency)}
                  {summary.linesWithoutBudget > 0 && summary.totalBudgeted !== null ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {summary.linesWithoutBudget} line{summary.linesWithoutBudget === 1 ? "" : "s"}{" "}
                      without a budget not counted
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pr-3 text-right whitespace-nowrap">
                  {formatMoney(summary.totalActual, currency)}
                </td>
                <td className="py-2 pr-3 text-right whitespace-nowrap">
                  {formatMoney(summary.totalRemaining, currency)}
                </td>
                <td className="py-2 pr-3" />
                {canEdit ? <td className="py-2" /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {recent.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Latest spending recorded ({actuals.length} line{actuals.length === 1 ? "" : "s"} in all)
          </summary>
          <ul className="mt-2 divide-y">
            {recent.map((actual) => (
              <li key={actual.id} className="flex flex-wrap justify-between gap-2 py-1">
                <span>
                  {formatDate(actual.spent_on)} · {lineName.get(actual.budget_line_id) ?? "—"}
                  {actual.description ? ` · ${actual.description}` : ""}
                  <span className="text-xs text-muted-foreground">
                    {actual.source === "csv" ? " · imported" : ""}
                  </span>
                </span>
                <span className="whitespace-nowrap">{formatMoney(actual.amount, currency)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {canEdit ? (
        <div className="space-y-5 border-t pt-4">
          <AddBudgetLineForm {...ids} />
          {lines.length > 0 ? (
            <AddActualForm
              {...ids}
              lines={lines.map((l) => ({ id: l.id, category: l.category }))}
            />
          ) : null}
          <CsvImportForm {...ids} />
        </div>
      ) : null}
    </div>
  );
}
