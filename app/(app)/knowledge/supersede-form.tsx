"use client";

import { useActionState } from "react";

import { Select, Textarea } from "@/components/learning/fields";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type FormState, supersedeFact } from "@/lib/learning/actions";
import { CONFIDENCES, SOURCE_KINDS } from "@/lib/learning/types";

export function SupersedeForm({ factId }: { factId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(supersedeFact, {
    status: "idle",
  });
  const id = (name: string) => `${name}-${factId.slice(0, 8)}`;
  return (
    <form action={formAction} className="space-y-3 rounded-md border p-3">
      <input type="hidden" name="factId" value={factId} />
      <div className="space-y-2">
        <Label htmlFor={id("fact")}>The newer fact</Label>
        <Textarea id={id("fact")} name="fact" required maxLength={4000} className="min-h-16" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={id("sourceKind")}>Source kind</Label>
          <Select id={id("sourceKind")} name="sourceKind" defaultValue="document">
            {SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("sourceRef")}>Source</Label>
          <Input id={id("sourceRef")} name="sourceRef" required maxLength={2000} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("confidence")}>Confidence</Label>
          <Select id={id("confidence")} name="confidence" defaultValue="stated">
            {CONFIDENCES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Replacing…" : "Replace"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
