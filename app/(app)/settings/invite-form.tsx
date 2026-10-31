"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteTeammate, type FormState } from "@/lib/auth/actions";

export function InviteForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(inviteTeammate, {
    status: "idle",
  });
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="space-y-2">
        <Label htmlFor="invite-email">Teammate&apos;s email</Label>
        <Input id="invite-email" name="email" type="email" required autoComplete="off" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invitation"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
