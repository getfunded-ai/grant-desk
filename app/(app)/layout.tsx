import { Suspense } from "react";
import { ShellHeader, ShellHeaderFallback } from "@/components/shell/header";
import { PendingInvitations } from "@/components/shell/pending-invitations";

/**
 * The signed-in app. The proxy already sent signed-out people to sign-in; the header and every
 * page check the user again on the server. Session reads sit inside Suspense (Cache Components).
 */
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={<ShellHeaderFallback />}>
        <ShellHeader />
      </Suspense>
      <Suspense>
        <PendingInvitations />
      </Suspense>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
