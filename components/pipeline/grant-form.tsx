"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/auth/actions";
import { createGrant, updateGrantDetails } from "@/lib/pipeline/actions";
import { PRESET_LABELS, type Preset } from "@/lib/pipeline/stages";

export type GrantFormValues = {
  grantId?: string;
  title: string;
  funderId: string | null;
  preset: Preset;
  amountRequested: string;
  amountAwarded: string;
  dueDate: string;
  dueTime: string;
  dueZone: string;
  decisionDate: string;
  awardStartDate: string;
  awardEndDate: string;
};

const FUNDER_KINDS = [
  ["foundation", "Foundation"],
  ["corporate", "Company"],
  ["federal", "Federal agency"],
  ["state", "State"],
  ["county", "County"],
  ["city", "City"],
  ["other", "Other"],
] as const;

export function GrantForm({
  values,
  funders,
  defaultZone,
}: {
  values: GrantFormValues;
  funders: { id: string; name: string }[];
  defaultZone: string;
}) {
  const editing = Boolean(values.grantId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    editing ? updateGrantDetails : createGrant,
    { status: "idle" },
  );
  const [funderChoice, setFunderChoice] = useState(
    values.funderId ?? (funders.length ? "" : "new"),
  );

  return (
    <form action={formAction} className="space-y-6">
      {values.grantId ? <input type="hidden" name="grantId" value={values.grantId} /> : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={500} defaultValue={values.title} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="funderId">Funder</Label>
          <select
            id="funderId"
            name="funderId"
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={funderChoice}
            onChange={(event) => setFunderChoice(event.target.value)}
          >
            <option value="">{editing ? "Keep the current funder" : "Choose a funder"}</option>
            {funders.map((funder) => (
              <option key={funder.id} value={funder.id}>
                {funder.name}
              </option>
            ))}
            <option value="new">Add a new funder…</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="preset">Stage labels</Label>
          <select
            id="preset"
            name="preset"
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            defaultValue={values.preset}
          >
            {(Object.keys(PRESET_LABELS) as Preset[]).map((preset) => (
              <option key={preset} value={preset}>
                {PRESET_LABELS[preset]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {funderChoice === "new" ? (
        <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="newFunderName">New funder&apos;s name</Label>
            <Input id="newFunderName" name="newFunderName" maxLength={300} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newFunderKind">Kind</Label>
            <select
              id="newFunderKind"
              name="newFunderKind"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              defaultValue="foundation"
            >
              {FUNDER_KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amountRequested">Amount asked (USD)</Label>
          <Input
            id="amountRequested"
            name="amountRequested"
            inputMode="decimal"
            placeholder="Leave empty if not decided"
            defaultValue={values.amountRequested}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amountAwarded">Amount awarded (USD)</Label>
          <Input
            id="amountAwarded"
            name="amountAwarded"
            inputMode="decimal"
            placeholder="Leave empty until awarded"
            defaultValue={values.amountAwarded}
          />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Submission deadline</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="dueDate">Date</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={values.dueDate} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueTime">Time (optional)</Label>
            <Input id="dueTime" name="dueTime" type="time" defaultValue={values.dueTime} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueZone">Time zone</Label>
            <Input
              id="dueZone"
              name="dueZone"
              placeholder={defaultZone}
              defaultValue={values.dueZone}
              list="time-zones"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Without a time, the deadline is the end of that day. Time zone is an IANA name such as
          America/New_York; empty means UTC.
        </p>
        <datalist id="time-zones">
          {COMMON_ZONES.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="decisionDate">Decision expected</Label>
          <Input
            id="decisionDate"
            name="decisionDate"
            type="date"
            defaultValue={values.decisionDate}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="awardStartDate">Award starts</Label>
          <Input
            id="awardStartDate"
            name="awardStartDate"
            type="date"
            defaultValue={values.awardStartDate}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="awardEndDate">Award ends</Label>
          <Input
            id="awardEndDate"
            name="awardEndDate"
            type="date"
            defaultValue={values.awardEndDate}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : editing ? "Save changes" : "Create grant"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

export const COMMON_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
];
