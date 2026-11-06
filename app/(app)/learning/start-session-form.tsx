"use client";

import { useActionState, useState } from "react";

import { Select, Textarea } from "@/components/learning/fields";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type FormState, startSession } from "@/lib/learning/actions";

type PlaybookOption = { key: string; title: string; steps: string[] };

export function StartSessionForm({
  playbooks,
  disabled,
}: {
  playbooks: PlaybookOption[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(startSession, {
    status: "idle",
  });
  const [key, setKey] = useState(playbooks[0]?.key ?? "");
  const chosen = playbooks.find((p) => p.key === key);
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="playbook">Playbook</Label>
        <Select
          id="playbook"
          name="playbook"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={disabled || playbooks.length === 0}
        >
          {playbooks.map((p) => (
            <option key={p.key} value={p.key}>
              {p.title}
            </option>
          ))}
        </Select>
        {chosen ? (
          <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
            {chosen.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="goal">Goal of this session</Label>
        <Textarea
          id="goal"
          name="goal"
          required
          minLength={3}
          maxLength={2000}
          disabled={disabled}
          placeholder="One or two sentences: what should this round of work find out or get done?"
        />
      </div>
      <Button type="submit" disabled={disabled || pending || playbooks.length === 0}>
        {pending ? "Freezing the packet…" : "Start session"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
