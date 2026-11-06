"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/auth/actions";
import { addActual, addBudgetLine, importActualsCsv } from "@/lib/budget/actions";
import { addChecklistItem, addReimbursement, addReport } from "@/lib/compliance/actions";

/** The "add one" forms on the award page. Each posts to one server action. */

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

type Ids = { grantId: string; awardId: string };

function Hidden({ grantId, awardId }: Ids) {
  return (
    <>
      <input type="hidden" name="grantId" value={grantId} />
      <input type="hidden" name="awardId" value={awardId} />
    </>
  );
}

export function AddReportForm(ids: Ids) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addReport, {
    status: "idle",
  });
  return (
    <form
      action={formAction}
      className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end"
    >
      <Hidden {...ids} />
      <div className="space-y-1">
        <Label htmlFor="report-title">Add a report</Label>
        <Input id="report-title" name="title" required maxLength={500} placeholder="What is due" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="report-kind">Type</Label>
        <select id="report-kind" name="kind" className={selectClass} defaultValue="other">
          <option value="other">Other</option>
          <option value="financial">Financial</option>
          <option value="performance">Performance or narrative</option>
          <option value="final_financial">Final financial</option>
          <option value="final_performance">Final performance</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="report-due">Due</Label>
        <Input id="report-due" name="dueDate" type="date" required />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function AddBudgetLineForm(ids: Ids) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addBudgetLine, {
    status: "idle",
  });
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <Hidden {...ids} />
      <div className="space-y-1">
        <Label htmlFor="line-category">Add a budget line</Label>
        <Input
          id="line-category"
          name="category"
          required
          maxLength={200}
          placeholder="Personnel, Travel, Supplies…"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="line-budgeted">Budgeted</Label>
        <Input
          id="line-budgeted"
          name="budgeted"
          inputMode="decimal"
          placeholder="Blank if not known"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function AddActualForm({
  grantId,
  awardId,
  lines,
}: Ids & { lines: Array<{ id: string; category: string }> }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addActual, {
    status: "idle",
  });
  return (
    <form
      action={formAction}
      className="grid gap-3 sm:grid-cols-[12rem_10rem_10rem_1fr_auto] sm:items-end"
    >
      <Hidden grantId={grantId} awardId={awardId} />
      <div className="space-y-1">
        <Label htmlFor="actual-line">Record spending</Label>
        <select id="actual-line" name="lineId" className={selectClass} required defaultValue="">
          <option value="" disabled>
            Budget line
          </option>
          {lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.category}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="actual-date">Spent on</Label>
        <Input id="actual-date" name="spentOn" type="date" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="actual-amount">Amount</Label>
        <Input id="actual-amount" name="amount" inputMode="decimal" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="actual-description">Description</Label>
        <Input id="actual-description" name="description" maxLength={1000} />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Record"}
      </Button>
      <div className="sm:col-span-5">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CsvImportForm(ids: Ids) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(importActualsCsv, {
    status: "idle",
  });
  return (
    <form action={formAction} className="space-y-3">
      <Hidden {...ids} />
      <div className="space-y-1">
        <Label htmlFor="csv-file">Import actuals from a CSV</Label>
        <Input id="csv-file" name="file" type="file" accept=".csv,text/csv" />
        <p className="text-xs text-muted-foreground">
          First row names the columns: date, category, amount, and optionally description.
          Categories that match a budget line go onto it; new ones become lines with no budgeted
          amount. Up to 1 MB.
        </p>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Or paste rows instead</summary>
        <textarea
          name="pasted"
          rows={4}
          className="mt-2 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          placeholder={
            "date,category,amount,description\n2027-03-14,Personnel,1250.00,March payroll"
          }
        />
      </details>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Importing…" : "Import"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

export function AddReimbursementForm(ids: Ids) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addReimbursement, {
    status: "idle",
  });
  return (
    <form
      action={formAction}
      className="grid gap-3 sm:grid-cols-[10rem_10rem_10rem_10rem_auto] sm:items-end"
    >
      <Hidden {...ids} />
      <div className="space-y-1">
        <Label htmlFor="reimb-number">Record an invoice</Label>
        <Input
          id="reimb-number"
          name="invoiceNumber"
          maxLength={100}
          placeholder="Invoice number"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="reimb-amount">Amount</Label>
        <Input
          id="reimb-amount"
          name="amount"
          inputMode="decimal"
          placeholder="Blank if not known"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="reimb-sent">Sent on</Label>
        <Input id="reimb-sent" name="sentOn" type="date" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="reimb-paid">Paid on</Label>
        <Input id="reimb-paid" name="paidOn" type="date" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Record"}
      </Button>
      <div className="sm:col-span-5">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function AddChecklistItemForm(ids: Ids) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addChecklistItem, {
    status: "idle",
  });
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Hidden {...ids} />
      <div className="space-y-1">
        <Label htmlFor="item-title">Add an item</Label>
        <Input
          id="item-title"
          name="title"
          required
          maxLength={500}
          placeholder="What needs doing"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="item-detail">Detail</Label>
        <Input id="item-detail" name="detail" maxLength={2000} placeholder="Where it comes from" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
