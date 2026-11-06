import { formatMoney, sumKnown } from "@/lib/budget/money";
import { deleteReimbursement, markReimbursementPaid } from "@/lib/compliance/actions";
import { type IsoDate, daysBetween, formatDate } from "@/lib/compliance/dates";
import type { ReimbursementRow } from "@/lib/compliance/store";
import { ActionForm } from "./action-form";
import { AddReimbursementForm } from "./small-forms";

/** Days outstanding only from the dates a person typed: no sent date, no number. */
function outstanding(row: ReimbursementRow, today: IsoDate): string {
  if (!row.sent_on) return "Not available";
  const end = row.paid_on ?? today;
  const days = daysBetween(row.sent_on, end);
  return row.paid_on
    ? `Paid after ${days} day${days === 1 ? "" : "s"}`
    : `${days} day${days === 1 ? "" : "s"} outstanding`;
}

export function Reimbursements({
  grantId,
  awardId,
  currency,
  rows,
  today,
  canEdit,
}: {
  grantId: string;
  awardId: string;
  currency: string;
  rows: ReimbursementRow[];
  today: IsoDate;
  canEdit: boolean;
}) {
  const open = rows.filter((r) => !r.paid_on);
  const openTotal = sumKnown(open.map((r) => r.amount));
  const unknownOpen = open.filter((r) => r.amount === null).length;

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No invoices or drawdown requests recorded yet.
        </p>
      ) : (
        <>
          <p className="text-sm">
            <span className="font-medium">{open.length}</span> unpaid, totalling{" "}
            <span className="font-medium">{formatMoney(openTotal, currency)}</span>
            {unknownOpen > 0 ? (
              <span className="text-muted-foreground">
                {" "}
                ({unknownOpen} with no amount recorded, not counted)
              </span>
            ) : null}
            .
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Invoice</th>
                  <th className="py-1 pr-3 text-right font-medium">Amount</th>
                  <th className="py-1 pr-3 font-medium">Sent</th>
                  <th className="py-1 pr-3 font-medium">Paid</th>
                  <th className="py-1 pr-3 font-medium">Days</th>
                  {canEdit ? <th className="py-1 font-medium" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="py-2 pr-3">
                      {row.invoice_number ?? (
                        <span className="text-muted-foreground">No number</span>
                      )}
                      {row.notes ? (
                        <div className="text-xs text-muted-foreground">{row.notes}</div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      {formatMoney(row.amount, currency)}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(row.sent_on)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {row.paid_on ? formatDate(row.paid_on) : "Not yet"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{outstanding(row, today)}</td>
                    {canEdit ? (
                      <td className="py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {!row.paid_on ? (
                            <ActionForm
                              action={markReimbursementPaid}
                              fields={{ grantId, reimbursementId: row.id }}
                              label="Mark paid"
                              pendingLabel="Saving…"
                              size="xs"
                            >
                              <input
                                type="date"
                                name="paidOn"
                                defaultValue={today}
                                aria-label="Date paid"
                                className="h-6 rounded-md border border-input bg-transparent px-1 text-xs"
                              />
                            </ActionForm>
                          ) : null}
                          <ActionForm
                            action={deleteReimbursement}
                            fields={{ grantId, reimbursementId: row.id }}
                            label="Remove"
                            size="xs"
                            variant="ghost"
                            confirm="Remove this invoice from the tracker?"
                          />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {canEdit ? (
        <div className="border-t pt-4">
          <AddReimbursementForm grantId={grantId} awardId={awardId} />
        </div>
      ) : null}
    </div>
  );
}
