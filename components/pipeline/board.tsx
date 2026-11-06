"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FormMessage } from "@/components/shell/form-message";
import type { FormState } from "@/lib/auth/actions";
import { moveGrantStage } from "@/lib/pipeline/actions";
import { formatMoney, daysFromNow, describeDueIn } from "@/lib/pipeline/format";
import { GRANT_STAGES, STAGE_LABELS, type GrantStage, type Preset } from "@/lib/pipeline/stages";
import { cn } from "@/lib/utils";

export type BoardGrant = {
  id: string;
  title: string;
  stage: GrantStage;
  preset: Preset;
  funderName: string | null;
  opportunityTitle: string | null;
  amountRequested: number | null;
  amountAwarded: number | null;
  currency: string;
  submissionDueAt: string | null;
  openTasks: number;
};

/**
 * The pipeline board. Drag a card to a stage, or use the "Move to" menu on the card (keyboard and
 * touch). The move is a person's action (moveGrantStage); the server checks the role again.
 */
export function Board({
  grants,
  labels,
  canEdit,
}: {
  grants: BoardGrant[];
  labels: Preset;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<GrantStage | null>(null);
  // Optimistic position while the server answers; reverted on error.
  const [moved, setMoved] = useState<Record<string, GrantStage>>({});

  function move(grantId: string, stage: GrantStage) {
    const grant = grants.find((g) => g.id === grantId);
    if (!grant || (moved[grantId] ?? grant.stage) === stage) return;
    setMoved((m) => ({ ...m, [grantId]: stage }));
    startTransition(async () => {
      const result = await moveGrantStage(grantId, stage);
      if (result.status === "error") {
        setMoved((m) => {
          const next = { ...m };
          delete next[grantId];
          return next;
        });
      }
      setState(result);
    });
  }

  return (
    <div className="space-y-3">
      <FormMessage state={state} />
      <div className="flex gap-3 overflow-x-auto pb-4" role="list" aria-label="Pipeline stages">
        {GRANT_STAGES.map((stage) => {
          const cards = grants.filter((g) => (moved[g.id] ?? g.stage) === stage);
          return (
            <section
              key={stage}
              role="listitem"
              aria-label={STAGE_LABELS[labels][stage]}
              className={cn(
                "flex w-60 shrink-0 flex-col rounded-lg border bg-muted/40 p-2",
                over === stage && dragging ? "ring-2 ring-ring" : "",
              )}
              onDragOver={(event) => {
                if (!canEdit || !dragging) return;
                event.preventDefault();
                if (over !== stage) setOver(stage);
              }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain") || dragging;
                setOver(null);
                setDragging(null);
                if (id) move(id, stage);
              }}
            >
              <header className="flex items-baseline justify-between px-1 pb-2">
                <h2 className="text-sm font-medium">{STAGE_LABELS[labels][stage]}</h2>
                <span className="text-xs text-muted-foreground">{cards.length}</span>
              </header>
              <ul className="flex min-h-16 flex-col gap-2">
                {cards.map((grant) => (
                  <li
                    key={grant.id}
                    draggable={canEdit && !pending}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", grant.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDragging(grant.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={cn(
                      "rounded-md border bg-card p-3 text-sm shadow-xs",
                      dragging === grant.id ? "opacity-50" : "",
                      canEdit ? "cursor-grab active:cursor-grabbing" : "",
                    )}
                  >
                    <Link
                      href={`/grants/${grant.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {grant.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {grant.funderName ?? grant.opportunityTitle ?? "Funder not stated"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {stage === "awarded" || stage === "active" || stage === "reporting"
                        ? `Awarded ${formatMoney(grant.amountAwarded, grant.currency)}`
                        : `Asking ${formatMoney(grant.amountRequested, grant.currency)}`}
                    </p>
                    <DueLine dueAt={grant.submissionDueAt} />
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {grant.preset === "sbir" ? (
                        <span className="rounded bg-muted px-1.5 py-0.5">SBIR</span>
                      ) : null}
                      {grant.openTasks > 0 ? <span>{grant.openTasks} open tasks</span> : null}
                      {canEdit ? (
                        <label className="ml-auto">
                          <span className="sr-only">Move {grant.title} to</span>
                          <select
                            aria-label={`Move ${grant.title} to`}
                            className="max-w-28 rounded border bg-background px-1 py-0.5 text-xs"
                            value={moved[grant.id] ?? grant.stage}
                            disabled={pending}
                            onChange={(event) => move(grant.id, event.target.value as GrantStage)}
                          >
                            {GRANT_STAGES.map((s) => (
                              <option key={s} value={s}>
                                {STAGE_LABELS[grant.preset][s]}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DueLine({ dueAt }: { dueAt: string | null }) {
  if (!dueAt) return null;
  const days = daysFromNow(dueAt);
  return (
    <p
      className={cn(
        "mt-1 text-xs",
        days < 0 ? "text-muted-foreground" : days <= 7 ? "text-destructive" : "",
      )}
    >
      Due {describeDueIn(days)}
    </p>
  );
}
