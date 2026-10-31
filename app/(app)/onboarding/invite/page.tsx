import Link from "next/link";
import { InviteForm } from "@/app/(app)/settings/invite-form";
import { APP_HOME_PATH } from "@/lib/auth/routes";
import { requireActiveOrganization } from "@/lib/auth/session";

export const metadata = { title: "Invite a teammate · Grant Desk" };

export default async function OnboardingInvitePage() {
  const { active } = await requireActiveOrganization();
  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Invite a teammate</h1>
        <p className="text-sm text-muted-foreground">
          {active.name} is ready. Invite one person to work on grants with you. You can do this
          later in Settings.
        </p>
      </div>
      <InviteForm organizationId={active.id} />
      <Link href={APP_HOME_PATH} className="inline-block text-sm underline underline-offset-4">
        Skip for now
      </Link>
    </div>
  );
}
