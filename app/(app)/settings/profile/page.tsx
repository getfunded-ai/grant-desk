import { getProfileName } from "@/lib/auth/org-store";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile · Grant Desk" };

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const fullName = supabase ? await getProfileName(supabase, user.id) : null;
  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email ?? "an account with no email"}. Teammates see your name on grants
          and tasks.
        </p>
      </div>
      <ProfileForm fullName={fullName ?? ""} />
    </div>
  );
}
