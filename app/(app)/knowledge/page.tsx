import Link from "next/link";

import { NotAvailable } from "@/components/learning/ai-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveOrganization } from "@/lib/auth/session";
import { getDb } from "@/lib/learning/db";
import { listFacts, listFunders } from "@/lib/learning/queries";
import { SUBJECT_KINDS, type SubjectKind } from "@/lib/learning/types";

import { FactForm } from "./fact-form";
import { SupersedeForm } from "./supersede-form";

export const metadata = { title: "Knowledge · Grant Desk" };

const CAN_EDIT = ["owner", "admin", "editor"];

const SUBJECT_LABELS: Record<SubjectKind, string> = {
  organization: "This organization",
  funder: "Funders",
  opportunity: "Opportunities",
  contact: "Contacts",
  grant: "Grants",
};

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; show?: string }>;
}) {
  const { subject, show } = await searchParams;
  const { active } = await requireActiveOrganization();
  const db = await getDb();
  if (!db)
    return <NotAvailable>The database is not set up on this copy of Grant Desk yet.</NotAvailable>;
  const filter = SUBJECT_KINDS.includes(subject as SubjectKind) ? (subject as SubjectKind) : null;
  const showAll = show === "all";
  const [facts, funders] = await Promise.all([
    listFacts(db, active.id, showAll ? "all" : "confirmed"),
    listFunders(db, active.id),
  ]);
  const funderName = new Map(funders.map((f) => [f.id, f.name]));
  const shown = facts.filter((f) => !filter || f.subject_kind === filter);
  const canEdit = CAN_EDIT.includes(active.role);
  const query = (next: { subject?: string | null; show?: string | null }) => {
    const p = new URLSearchParams();
    const s = next.subject === undefined ? filter : next.subject;
    const a = next.show === undefined ? (showAll ? "all" : null) : next.show;
    if (s) p.set("subject", s);
    if (a) p.set("show", a);
    const q = p.toString();
    return q ? `/knowledge?${q}` : "/knowledge";
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">What {active.name} knows</h1>
        <p className="text-sm text-muted-foreground">
          Confirmed facts with their sources. A fact is replaced by a newer one, never deleted, so
          the record shows what was known and when. Facts from filings say what the filing shows;
          they never say a funder is interested or that anyone is eligible.
        </p>
      </div>

      <nav aria-label="Filter" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link
          href={query({ subject: null })}
          className={!filter ? "font-medium" : "text-muted-foreground"}
        >
          All
        </Link>
        {SUBJECT_KINDS.map((k) => (
          <Link
            key={k}
            href={query({ subject: k })}
            className={filter === k ? "font-medium" : "text-muted-foreground"}
          >
            {SUBJECT_LABELS[k]}
          </Link>
        ))}
        <Link
          href={query({ show: showAll ? null : "all" })}
          className="ml-auto text-muted-foreground"
        >
          {showAll ? "Hide superseded and proposed" : "Show superseded and proposed"}
        </Link>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>Facts</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {shown.length === 0 ? (
            <NotAvailable>
              Not stated in filings or recorded yet: no {showAll ? "" : "confirmed "}facts
              {filter ? ` about ${SUBJECT_LABELS[filter].toLowerCase()}` : ""}.
            </NotAvailable>
          ) : (
            <ul className="divide-y">
              {shown.map((f) => (
                <li key={f.id} className="space-y-2 py-3">
                  <p className="text-sm">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {SUBJECT_LABELS[f.subject_kind]}
                      {f.subject_kind === "funder" && f.subject_id
                        ? `: ${funderName.get(f.subject_id) ?? "Not available"}`
                        : ""}
                    </span>{" "}
                    {f.fact}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Source: {f.source_kind}, {f.source_ref} · confidence: {f.confidence} ·{" "}
                    {f.status === "confirmed"
                      ? `confirmed ${f.confirmed_at?.slice(0, 10) ?? ""}`
                      : f.status === "superseded"
                        ? "superseded by a newer fact"
                        : "proposed, not confirmed"}
                  </p>
                  {f.status === "confirmed" && canEdit ? (
                    <details>
                      <summary className="cursor-pointer text-xs underline underline-offset-4">
                        Replace with a newer fact
                      </summary>
                      <div className="mt-2">
                        <SupersedeForm factId={f.id} />
                      </div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Add a fact you have confirmed</CardTitle>
            <CardDescription>
              Say where it comes from. Unknown stays unknown; never write 0.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FactForm funders={funders} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
