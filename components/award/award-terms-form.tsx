"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/auth/actions";
import { saveAwardTerms } from "@/lib/compliance/actions";
import { FINAL_REPORT_LAG_DAYS, INTERIM_REPORT_LAG_DAYS } from "@/lib/compliance/rules";
import { FREQUENCY_LABELS, type ReportFrequency } from "@/lib/compliance/schedule";

export interface AwardTermsValues {
  isFederal: boolean;
  awardNumber: string;
  amountAwarded: string;
  periodStart: string;
  periodEnd: string;
  paymentMethod: string;
  indirectMethod: string;
  indirectRate: string;
  reportFrequency: ReportFrequency;
  reportLagDays: number;
  finalReportLagDays: number;
  notes: string;
}

export const EMPTY_TERMS: AwardTermsValues = {
  isFederal: false,
  awardNumber: "",
  amountAwarded: "",
  periodStart: "",
  periodEnd: "",
  paymentMethod: "",
  indirectMethod: "",
  indirectRate: "",
  reportFrequency: "quarterly",
  reportLagDays: 30,
  finalReportLagDays: 60,
  notes: "",
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function AwardTermsForm({
  grantId,
  initial,
  isNew,
}: {
  grantId: string;
  initial: AwardTermsValues;
  isNew: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveAwardTerms, {
    status: "idle",
  });
  const [isFederal, setIsFederal] = useState(initial.isFederal);
  const [frequency, setFrequency] = useState<ReportFrequency>(initial.reportFrequency);
  const [indirectMethod, setIndirectMethod] = useState(initial.indirectMethod);
  const showRate = indirectMethod === "negotiated_rate" || indirectMethod === "other";
  const interimLag = frequency === "none" ? null : INTERIM_REPORT_LAG_DAYS[frequency];

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="grantId" value={grantId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amountAwarded">Amount awarded</Label>
          <Input
            id="amountAwarded"
            name="amountAwarded"
            inputMode="decimal"
            placeholder="Leave blank if not known"
            defaultValue={initial.amountAwarded}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="awardNumber">Award number</Label>
          <Input
            id="awardNumber"
            name="awardNumber"
            maxLength={100}
            placeholder="The funder’s identifier (FAIN for federal awards)"
            defaultValue={initial.awardNumber}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodStart">Period of performance starts</Label>
          <Input
            id="periodStart"
            name="periodStart"
            type="date"
            defaultValue={initial.periodStart}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodEnd">Period of performance ends</Label>
          <Input id="periodEnd" name="periodEnd" type="date" defaultValue={initial.periodEnd} />
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="isFederal"
          className="mt-0.5 size-4"
          checked={isFederal}
          onChange={(event) => setIsFederal(event.target.checked)}
        />
        <span>
          <span className="font-medium">This is a federal award</span>
          <span className="block text-muted-foreground">
            Report dates then follow 2 CFR 200: {INTERIM_REPORT_LAG_DAYS.quarterly} days after a
            quarter or half-year, {INTERIM_REPORT_LAG_DAYS.annual} days after a year, and{" "}
            {FINAL_REPORT_LAG_DAYS} days after the end date for the final reports. The federal
            checklist is used.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="paymentMethod">How the funder pays</Label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            className={selectClass}
            defaultValue={initial.paymentMethod}
          >
            <option value="">Not stated</option>
            <option value="reimbursement">Reimbursement (we spend, then invoice)</option>
            <option value="advance">Advance (drawdowns before spending)</option>
            <option value="lump_sum">Lump sum</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="indirectMethod">Indirect costs</Label>
          <select
            id="indirectMethod"
            name="indirectMethod"
            className={selectClass}
            value={indirectMethod}
            onChange={(event) => setIndirectMethod(event.target.value)}
          >
            <option value="">Not stated</option>
            <option value="de_minimis">De minimis rate (15% of modified total direct costs)</option>
            <option value="negotiated_rate">Negotiated rate (NICRA)</option>
            <option value="none">None charged</option>
            <option value="other">Other</option>
          </select>
        </div>
        {showRate ? (
          <div className="space-y-2">
            <Label htmlFor="indirectRate">Indirect rate (percent)</Label>
            <Input
              id="indirectRate"
              name="indirectRate"
              inputMode="decimal"
              placeholder="for example 22.5"
              defaultValue={initial.indirectRate}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="reportFrequency">Reports due</Label>
          <select
            id="reportFrequency"
            name="reportFrequency"
            className={selectClass}
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as ReportFrequency)}
          >
            {(Object.keys(FREQUENCY_LABELS) as ReportFrequency[]).map((key) => (
              <option key={key} value={key}>
                {FREQUENCY_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        {isFederal ? (
          <p className="text-sm text-muted-foreground sm:col-span-2 sm:self-end">
            {frequency === "none"
              ? `Only the final reports, ${FINAL_REPORT_LAG_DAYS} days after the end date.`
              : `Each report ${interimLag} days after its period; final reports ${FINAL_REPORT_LAG_DAYS} days after the end date.`}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="reportLagDays">Days after each period</Label>
              <Input
                id="reportLagDays"
                name="reportLagDays"
                type="number"
                min={0}
                max={365}
                defaultValue={initial.reportLagDays}
                disabled={frequency === "none"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finalReportLagDays">Days after the end date (final report)</Label>
              <Input
                id="finalReportLagDays"
                name="finalReportLagDays"
                type="number"
                min={0}
                max={365}
                defaultValue={initial.finalReportLagDays}
              />
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Terms and conditions worth remembering</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={4000}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          defaultValue={initial.notes}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Enter the award" : "Save terms"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Saving writes the report dates to the calendar. Reports already marked submitted are kept.
        </p>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
