"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvitation, declineInvitation, type FormState } from "@/lib/auth/actions";
import { FormMessage } from "./form-message";
import { APP_HOME_PATH } from "@/lib/auth/routes";

export function InvitationButtons({ organizationId }: { organizationId: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({ status: "idle" });
  return (
    <>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvitation(organizationId);
            // A full load: the router's own refresh after the action would override a soft push.
            if (result.status === "success") window.location.assign(APP_HOME_PATH);
            else setState(result);
          })
        }
      >
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await declineInvitation(organizationId);
            if (result.status === "error") setState(result);
          })
        }
      >
        Decline
      </Button>
      <FormMessage state={state} />
    </>
  );
}
