import Link from "next/link";
import { getOrganizationContext } from "@/lib/auth/session";
import { NAV_ITEMS } from "./nav-items";
import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";

export async function ShellHeader() {
  const { user, organizations, active } = await getOrganizationContext();
  return (
    <ShellFrame>
      <OrgSwitcher organizations={organizations} activeId={active?.id ?? null} />
      <nav aria-label="Main" className="flex items-center gap-4 text-sm">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-muted-foreground hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto">
        <UserMenu email={user.email} />
      </div>
    </ShellFrame>
  );
}

export function ShellHeaderFallback() {
  return (
    <ShellFrame>
      <span className="text-sm text-muted-foreground">Loading…</span>
    </ShellFrame>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Grant Desk
        </Link>
        {children}
      </div>
    </header>
  );
}
