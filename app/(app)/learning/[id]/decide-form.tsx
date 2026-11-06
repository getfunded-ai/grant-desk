"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/shell/form-message";
import { Button } from "@/components/ui/button";
import { type FormState, decideProposal } from "@/lib/learning/actions";

export function DecideForm({ proposalId, canAccept }: { proposalId: string; canAccept: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(decideProposal, {
    status: "idle",
  });
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="proposalId" value={proposalId} />
      <Button
        type="submit"
        name="decision"
        value="accept"
        size="sm"
        disabled={pending || !canAccept}
      >
        Accept
      </Button>
      <Button
        type="submit"
        name="decision"
        value="reject"
        size="sm"
        variant="outline"
        disabled={pending}
      >
        Reject
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
