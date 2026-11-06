"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestMagicLink, type FormState } from "@/lib/auth/actions";

const LINK_ERRORS: Record<string, string> = {
  link: "That sign-in link did not work. It may have expired or been opened in another browser. Ask for a new one.",
  "not-configured": "Sign-in is not set up on this copy of Grant Desk yet.",
};

export function SignInForm() {
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState<FormState, FormData>(requestMagicLink, {
    status: "idle",
  });
  const linkError = LINK_ERRORS[searchParams.get("error") ?? ""];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
      {state.status === "idle" && linkError ? (
        <FormMessage state={{ status: "error", message: linkError }} />
      ) : (
        <FormMessage state={state} />
      )}
    </form>
  );
}
