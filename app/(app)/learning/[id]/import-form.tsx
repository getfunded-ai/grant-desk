"use client";

import { useActionState } from "react";

import { Textarea } from "@/components/learning/fields";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type FormState, importResults } from "@/lib/learning/actions";

export function ImportForm({ sessionId }: { sessionId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(importResults, {
    status: "idle",
  });
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="space-y-2">
        <Label htmlFor="results">Paste the results JSON</Label>
        <Textarea
          id="results"
          name="results"
          className="min-h-40 font-mono text-xs"
          spellCheck={false}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="file">Or choose the file</Label>
        <Input id="file" name="file" type="file" accept=".json,application/json" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Import results"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
