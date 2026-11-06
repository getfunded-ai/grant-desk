"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/auth/actions";
import { trackOpportunity } from "@/lib/grants-gov/actions";

/** "Track this": one click creates a grant in stage prospect and opens it. */
export function TrackButton({
  opportunityId,
  size = "default",
}: {
  opportunityId: string;
  size?: "default" | "sm";
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(trackOpportunity, {
    status: "idle",
  });
  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Button type="submit" size={size} disabled={pending}>
        {pending ? "Tracking…" : "Track this"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
