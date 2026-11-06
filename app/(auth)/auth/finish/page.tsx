import { Suspense } from "react";
import { FinishSignIn } from "./finish-sign-in";

export const metadata = { title: "Signing in · Grant Desk" };

export default function FinishPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Signing you in…</p>}>
      <FinishSignIn />
    </Suspense>
  );
}
