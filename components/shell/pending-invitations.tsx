import { getCurrentUser } from "@/lib/auth/session";
import { InvitationButtons } from "./invitation-buttons";

/** Invitations waiting for the signed-in person. Nobody joins an organization until they accept. */
export async function PendingInvitations() {
  const user = await getCurrentUser();
  if (!user?.pendingInvitations.length) return null;
  return (
    <section aria-label="Invitations" className="border-b bg-muted/50">
      <ul className="mx-auto w-full max-w-5xl space-y-2 px-6 py-3">
        {user.pendingInvitations.map((invitation) => (
          <li key={invitation.organizationId} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="mr-auto">
              You are invited to join <strong>{invitation.organizationName}</strong> as{" "}
              {invitation.role === "viewer" ? "a viewer" : `an ${invitation.role}`}.
            </span>
            <InvitationButtons organizationId={invitation.organizationId} />
          </li>
        ))}
      </ul>
    </section>
  );
}
