"use client";

import { useActionState } from "react";

import { Select, Textarea } from "@/components/learning/fields";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type FormState, closeSession } from "@/lib/learning/actions";
import { APPLIES_TO, APPLIES_TO_LABELS } from "@/lib/learning/types";

export function CloseForm({
  sessionId,
  hasLessons,
  pending: undecided,
}: {
  sessionId: string;
  hasLessons: boolean;
  pending: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(closeSession, {
    status: "idle",
  });
  return (
    <form action={formAction} className="space-y-4 border-t pt-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <p className="text-sm font-medium">Close this session</p>
      {undecided > 0 ? (
        <p className="text-sm text-muted-foreground">
          {undecided} proposal{undecided === 1 ? " is" : "s are"} still waiting for a decision. They
          stay pending after closing; stage moves are decided on the grant record page.
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="lesson">
          {hasLessons ? "One more lesson (optional)" : "What did this session teach?"}
        </Label>
        <Textarea
          id="lesson"
          name="lesson"
          required={!hasLessons}
          maxLength={4000}
          placeholder="Something the next session should do differently or keep doing."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="appliesTo">Applies to</Label>
          <Select id="appliesTo" name="appliesTo" defaultValue="general">
            {APPLIES_TO.map((a) => (
              <option key={a} value={a}>
                {APPLIES_TO_LABELS[a]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="evidence">Evidence for the lesson</Label>
          <Textarea id="evidence" name="evidence" className="min-h-9" maxLength={4000} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="summary">Summary of the session (optional)</Label>
        <Textarea id="summary" name="summary" maxLength={4000} />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Closing…" : "Close session"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
