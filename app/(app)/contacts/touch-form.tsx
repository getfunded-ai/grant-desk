"use client";

import { useActionState } from "react";

import { Select, Textarea } from "@/components/learning/fields";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type FormState, logTouch } from "@/lib/learning/actions";
import { TOUCH_KINDS } from "@/lib/learning/types";

export function TouchForm({
  contacts,
  grants,
}: {
  contacts: { id: string; name: string }[];
  grants: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(logTouch, {
    status: "idle",
  });
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="touch-contact">Contact</Label>
        <Select id="touch-contact" name="contactId" required defaultValue={contacts[0]?.id}>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="touch-kind">Kind</Label>
          <Select id="touch-kind" name="kind" defaultValue="email">
            {TOUCH_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="touch-direction">Direction</Label>
          <Select id="touch-direction" name="direction" defaultValue="out">
            <option value="out">We reached out</option>
            <option value="in">They reached us</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="touch-when">When</Label>
          <Input id="touch-when" name="happenedAt" type="datetime-local" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="touch-grant">Grant (optional)</Label>
        <Select id="touch-grant" name="grantId" defaultValue="">
          <option value="">Not about one grant</option>
          {grants.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="touch-summary">What happened</Label>
        <Textarea id="touch-summary" name="summary" required maxLength={4000} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Logging…" : "Log touch"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
