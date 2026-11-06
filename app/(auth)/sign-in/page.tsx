import { Suspense } from "react";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · Grant Desk" };

export default function SignInPage() {
  const configured = getSupabasePublicEnv() !== null;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          We email you a link. No password. New here? The same link creates your account.
        </p>
      </div>
      {configured ? (
        <Suspense>
          <SignInForm />
        </Suspense>
      ) : (
        <p className="rounded-md border bg-muted p-3 text-sm">
          Sign-in is not set up on this copy of Grant Desk yet. The setup steps are in
          docs/DEPLOY.md.
        </p>
      )}
    </div>
  );
}
