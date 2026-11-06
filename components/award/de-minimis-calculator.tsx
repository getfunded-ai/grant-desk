"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/budget/money";
import { deMinimisIndirect, parseAmount, parseAmountList } from "@/lib/compliance/indirect";
import { DE_MINIMIS_RATE, MTDC_SUBAWARD_CAP_USD, ecfrSectionUrl } from "@/lib/compliance/rules";

/** Works out the de minimis indirect amount from the budget figures typed in. Nothing is saved. */
export function DeMinimisCalculator({ currency }: { currency: string }) {
  const [included, setIncluded] = useState("");
  const [excluded, setExcluded] = useState("");
  const [subawards, setSubawards] = useState("");
  const includedValue = parseAmount(included);
  const excludedValue = parseAmount(excluded);
  const subawardLines = subawards.split(/[\s;]+/).filter((part) => part.trim() !== "");
  const subawardValues = parseAmountList(subawards);
  const unreadable = [
    included.trim() !== "" && includedValue === null ? "direct costs that count" : null,
    excluded.trim() !== "" && excludedValue === null ? "direct costs left out" : null,
    subawardLines.length !== subawardValues.length ? "one or more subaward lines" : null,
  ].filter((part): part is string => part !== null);
  const result = deMinimisIndirect({
    includedDirectCosts: includedValue ?? 0,
    excludedDirectCosts: excludedValue ?? 0,
    subawards: subawardValues,
  });
  // No figure is shown while any field cannot be read: a guess is not an answer.
  const hasInput = (included.trim() !== "" || subawards.trim() !== "") && unreadable.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="dm-included">Direct costs that count</Label>
          <Input
            id="dm-included"
            inputMode="decimal"
            value={included}
            onChange={(event) => setIncluded(event.target.value)}
            placeholder="Salaries, fringe, supplies, services, travel"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dm-excluded">Direct costs left out</Label>
          <Input
            id="dm-excluded"
            inputMode="decimal"
            value={excluded}
            onChange={(event) => setExcluded(event.target.value)}
            placeholder="Equipment, rent, tuition, participant support"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="dm-subawards">Subawards, one amount per line</Label>
          <textarea
            id="dm-subawards"
            rows={2}
            value={subawards}
            onChange={(event) => setSubawards(event.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            placeholder="Only the first US$50,000 of each counts"
          />
        </div>
      </div>
      {unreadable.length > 0 ? (
        <p className="text-sm text-destructive" role="alert">
          Could not read {unreadable.join(", ")}. Use plain numbers such as 12,500.75.
        </p>
      ) : null}
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
        <dt className="text-muted-foreground">Subawards counted</dt>
        <dd className="text-right">
          {hasInput ? formatMoney(result.subawardsIncluded, currency) : "—"}
        </dd>
        <dt className="text-muted-foreground">Modified total direct costs</dt>
        <dd className="text-right">{hasInput ? formatMoney(result.mtdc, currency) : "—"}</dd>
        <dt className="font-medium">Indirect at {Math.round(DE_MINIMIS_RATE * 100)}%</dt>
        <dd className="text-right font-medium">
          {hasInput ? formatMoney(result.indirect, currency) : "—"}
        </dd>
        <dt className="text-muted-foreground">Total with indirect</dt>
        <dd className="text-right">
          {hasInput ? formatMoney(result.totalWithIndirect, currency) : "—"}
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">
        2 CFR{" "}
        <a
          className="underline underline-offset-4"
          href={ecfrSectionUrl("414")}
          target="_blank"
          rel="noreferrer"
        >
          200.414(f)
        </a>{" "}
        sets the rate; 200.1 defines modified total direct costs and caps each subaward at{" "}
        {formatMoney(MTDC_SUBAWARD_CAP_USD, "USD")}. A negotiated rate agreement replaces this.
        Check the notice of award: some programs cap indirect costs lower.
      </p>
    </div>
  );
}
