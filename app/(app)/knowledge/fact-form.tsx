"use client";

import { useActionState, useState } from "react";

import { Select, Textarea } from "@/components/learning/fields";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type FormState, addFact } from "@/lib/learning/actions";
import { CONFIDENCES, SOURCE_KINDS, SUBJECT_KINDS } from "@/lib/learning/types";

export function FactForm({ funders }: { funders: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addFact, {
    status: "idle",
  });
  const [subjectKind, setSubjectKind] = useState("organization");
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="subjectKind">About</Label>
          <Select
            id="subjectKind"
            name="subjectKind"
            value={subjectKind}
            onChange={(e) => setSubjectKind(e.target.value)}
          >
            {SUBJECT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
        {subjectKind === "funder" ? (
          <div className="space-y-2">
            <Label htmlFor="subjectId">Which funder</Label>
            <Select id="subjectId" name="subjectId" defaultValue="">
              <option value="">Not tied to a funder record</option>
              {funders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="fact">The fact</Label>
        <Textarea id="fact" name="fact" required maxLength={4000} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="sourceKind">Source kind</Label>
          <Select id="sourceKind" name="sourceKind" defaultValue="document">
            {SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sourceRef">Source (URL, document, or who said it)</Label>
          <Input id="sourceRef" name="sourceRef" required maxLength={2000} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confidence">Confidence</Label>
          <Select id="confidence" name="confidence" defaultValue="stated">
            {CONFIDENCES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save fact"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
