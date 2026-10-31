"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, type FormState } from "@/lib/auth/actions";

export function ProfileForm({ fullName }: { fullName: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateProfile, {
    status: "idle",
  });
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Your name</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          maxLength={120}
          autoComplete="name"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
