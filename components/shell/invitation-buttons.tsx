"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvitation, declineInvitation } from "@/lib/auth/actions";
import { APP_HOME_PATH } from "@/lib/auth/routes";

export function InvitationButtons({ organizationId }: { organizationId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await acceptInvitation(organizationId);
            // A full load: the router's own refresh after the action would override a soft push.
            window.location.assign(APP_HOME_PATH);
          })
        }
      >
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => declineInvitation(organizationId))}
      >
        Decline
      </Button>
    </>
  );
}
