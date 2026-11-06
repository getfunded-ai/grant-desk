"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganization, type FormState } from "@/lib/auth/actions";

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createOrganization, {
    status: "idle",
  });
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Organization name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          autoComplete="organization"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create organization"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
