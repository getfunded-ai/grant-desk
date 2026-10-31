import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { countMembers, INVITER_ROLES } from "@/lib/auth/org-store";
import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Settings · Grant Desk" };

const ROLE_LABELS = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer" } as const;

export default async function SettingsPage() {
  const { user, active } = await requireActiveOrganization();
  const supabase = await createClient();
  const members = supabase ? await countMembers(supabase, active.id) : null;
  const canInvite = INVITER_ROLES.includes(active.role);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>{active.name}</CardTitle>
          <CardDescription>The organization you are working in now.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Your role</dt>
            <dd>{ROLE_LABELS[active.role] ?? active.role}</dd>
            <dt className="text-muted-foreground">Members</dt>
            <dd>{members ?? "Not available"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
          <CardDescription>
            {canInvite
              ? "They get an email and join as an editor once they accept."
              : "Only an owner or admin can invite people to this organization."}
          </CardDescription>
        </CardHeader>
        {canInvite ? (
          <CardContent>
            <InviteForm organizationId={active.id} />
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
          <CardDescription>
            Signed in as {user.email ?? "an account with no email"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/profile" className="text-sm underline underline-offset-4">
            Edit your name
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
