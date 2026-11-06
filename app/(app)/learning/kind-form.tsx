"use client";

import { useActionState } from "react";

import { Select } from "@/components/learning/fields";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type FormState, updateOrganizationKind } from "@/lib/learning/actions";
import {
  ORGANIZATION_KIND_LABELS,
  ORGANIZATION_KINDS,
  type OrganizationKind,
} from "@/lib/learning/types";

export function KindForm({ kind }: { kind: OrganizationKind }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateOrganizationKind, {
    status: "idle",
  });
  return (
    <form action={formAction} className="space-y-2 border-t pt-4">
      <Label htmlFor="kind">Kind of organization (sets which playbooks apply)</Label>
      <div className="flex gap-2">
        <Select id="kind" name="kind" defaultValue={kind} className="max-w-md">
          {ORGANIZATION_KINDS.map((k) => (
            <option key={k} value={k}>
              {ORGANIZATION_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
