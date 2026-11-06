"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { safeNextPath, SIGN_IN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/client";

/**
 * Invite emails carry the session after `#` in the address, which only the browser can read.
 * Store it as the sign-in cookie, clear it from the address bar, and move on.
 */
export function FinishSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState(false);
  // The hash is read once; React's development double-run would otherwise see it already cleared.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    storeSessionFromHash()
      .then((ok) => {
        if (!ok) return setFailed(true);
        router.replace(safeNextPath(searchParams.get("next")));
        router.refresh();
      })
      .catch(() => setFailed(true));
  }, [router, searchParams]);

  if (!failed) return <p className="text-sm text-muted-foreground">Signing you in…</p>;
  return (
    <div className="space-y-2 text-sm">
      <p>This link did not work. It may have expired or been used already.</p>
      <Link className="font-medium underline underline-offset-4" href={SIGN_IN_PATH}>
        Get a new sign-in link
      </Link>
    </div>
  );
}

async function storeSessionFromHash(): Promise<boolean> {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken || !refreshToken) return false;
  const { error } = await createClient().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return !error;
}
