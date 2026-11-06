import Link from "next/link";
import { Board } from "@/components/pipeline/board";
import { Button } from "@/components/ui/button";
import { requireActiveOrganization } from "@/lib/auth/session";
import { userDb } from "@/lib/pipeline/client";
import { canEdit } from "@/lib/pipeline/permissions";
import { isPreset, PRESET_LABELS, type Preset } from "@/lib/pipeline/stages";
import { listGrants } from "@/lib/pipeline/store";
import { cn } from "@/lib/utils";

export const metadata = { title: "Grants · Grant Desk" };

export default async function GrantsPage({
  searchParams,
}: {
  searchParams: Promise<{ labels?: string }>;
}) {
  const { active } = await requireActiveOrganization();
  const { labels } = await searchParams;
  const preset: Preset = isPreset(labels) ? labels : "standard";
  const db = await userDb();
  const grants = db ? await listGrants(db, active.id) : [];
  const editor = canEdit(active.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Grants</h1>
        <nav aria-label="Stage labels" className="flex items-center gap-1 text-sm">
          {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
            <Link
              key={p}
              href={p === "standard" ? "/grants" : `/grants?labels=${p}`}
              className={cn(
                "rounded-md px-2 py-1",
                p === preset
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={p === preset ? "page" : undefined}
            >
              {PRESET_LABELS[p]} labels
            </Link>
          ))}
        </nav>
        {editor ? (
          <Button asChild size="sm" className="ml-auto">
            <Link href="/grants/new">New grant</Link>
          </Button>
        ) : null}
      </div>
      {grants.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No grants yet.{" "}
          {editor ? "Add one with New grant, or track an opportunity." : "An editor can add one."}
        </p>
      ) : null}
      <Board
        grants={grants.map((g) => ({
          id: g.id,
          title: g.title,
          stage: g.stage,
          preset: g.preset,
          funderName: g.funderName,
          opportunityTitle: g.opportunityTitle,
          amountRequested: g.amount_requested,
          amountAwarded: g.amount_awarded,
          currency: g.currency,
          submissionDueAt: g.submission_due_at,
          openTasks: g.openTasks,
        }))}
        labels={preset}
        canEdit={editor}
      />
      <p className="text-xs text-muted-foreground">
        Drag a card between stages, or use the menu on the card. Every move is recorded with who
        made it. Tools and AI never move a grant: they propose, and you accept on the grant&apos;s
        page.
      </p>
    </div>
  );
}
