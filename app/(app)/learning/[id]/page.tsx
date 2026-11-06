import Link from "next/link";
import { notFound } from "next/navigation";

import { AiLabel, NotAvailable } from "@/components/learning/ai-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveOrganization } from "@/lib/auth/session";
import { getDb } from "@/lib/learning/db";
import { renderPacketMarkdown } from "@/lib/learning/packet";
import { getPlaybook } from "@/lib/learning/playbooks";
import {
  getSession,
  listSessionLessons,
  listSessionOutcomes,
  listSessionProposals,
} from "@/lib/learning/queries";
import { APPLIES_TO_LABELS, ITEM_KIND_LABELS, type Packet } from "@/lib/learning/types";

import { CloseForm } from "./close-form";
import { CopyButton } from "./copy-button";
import { DecideForm } from "./decide-form";
import { ImportForm } from "./import-form";

export const metadata = { title: "Learning session · Grant Desk" };

const CAN_EDIT = ["owner", "admin", "editor"];

function when(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace("T", " ") + " UTC" : "Not available";
}

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { active } = await requireActiveOrganization();
  const db = await getDb();
  if (!db)
    return <NotAvailable>The database is not set up on this copy of Grant Desk yet.</NotAvailable>;
  const session = await getSession(db, active.id, id);
  if (!session) notFound();
  const playbook = getPlaybook(session.playbook_key);
  const packet = session.packet as unknown as Packet;
  const markdown = renderPacketMarkdown(
    packet,
    playbook ?? { title: session.playbook_key, body: "Playbook text not available." },
  );
  const [proposals, lessons] = await Promise.all([
    listSessionProposals(db, session.id),
    listSessionLessons(db, session.id),
  ]);
  const outcomes = await listSessionOutcomes(db, session, proposals);
  const isOpen = session.status === "open";
  const canEdit = CAN_EDIT.includes(active.role);
  const pending = proposals.filter((p) => p.status === "proposed").length;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/learning" className="underline underline-offset-4">
            Learning sessions
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Session {session.number}: {playbook?.title ?? session.playbook_key}
        </h1>
        <p className="text-sm text-muted-foreground">{session.goal}</p>
        <p className="text-xs text-muted-foreground">
          {isOpen ? `Open since ${when(session.opened_at)}` : `Closed ${when(session.closed_at)}`} ·{" "}
          {proposals.length} proposal{proposals.length === 1 ? "" : "s"}
          {pending ? ` (${pending} waiting for a decision)` : ""}
        </p>
      </div>

      {outcomes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Outcomes since this session opened</CardTitle>
            <CardDescription>
              From the stage history of grants this session proposed something on.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {outcomes.map((o) => (
                <li key={o.grant_id}>
                  <Link href={`/grants/${o.grant_id}`} className="underline underline-offset-4">
                    {o.title}
                  </Link>{" "}
                  was marked <strong>{o.to_stage}</strong> on {o.changed_at.slice(0, 10)}.
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>The packet</CardTitle>
          <CardDescription>
            Frozen when the session opened. Paste it into any assistant, or give it the downloaded
            file. Private contact details are never in it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <CopyButton text={markdown} />
            <Button asChild variant="outline">
              <a
                href={`/learning/${session.id}/packet`}
                download={`learning-session-${session.number}.md`}
              >
                Download packet
              </a>
            </Button>
          </div>
          <details>
            <summary className="cursor-pointer text-sm underline underline-offset-4">
              Show the packet
            </summary>
            <pre className="mt-3 max-h-[32rem] overflow-auto rounded-md border bg-muted/30 p-4 text-xs whitespace-pre-wrap">
              {markdown}
            </pre>
          </details>
        </CardContent>
      </Card>

      {isOpen && canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Import results</CardTitle>
            <CardDescription>
              The results file for this session (JSON, format version 1). Every item becomes a
              proposal below. The file is rejected if it is for another session, has no model or
              date, or holds more than 25 items; an item is rejected if it claims someone is
              interested, eligible or will fund, or if a fact, contact, draft or stage move has no
              evidence.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportForm sessionId={session.id} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Proposals</CardTitle>
          <CardDescription>
            Each one was prepared with AI and must be checked by a person. Accepting writes the
            record; rejecting writes nothing. A stage move is accepted on the grant record page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {proposals.length === 0 ? (
            <NotAvailable>No results imported yet.</NotAvailable>
          ) : (
            <ul className="divide-y">
              {proposals.map((p) => (
                <li key={p.id} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {ITEM_KIND_LABELS[p.payload.kind] ?? p.payload.kind}
                    </span>
                    <span className="text-sm font-medium">{p.summary}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {p.status === "proposed"
                        ? "waiting for a decision"
                        : `${p.status} ${p.decided_at ? p.decided_at.slice(0, 10) : ""}`}
                    </span>
                  </div>
                  <ProposalBody payload={p.payload} />
                  <AiLabel by={p.payload.produced_by} evidence={p.payload.evidence ?? []} />
                  {p.payload.kind === "stage_move" && p.grant_id ? (
                    <p className="text-xs">
                      Accept or reject this stage move on{" "}
                      <Link href={`/grants/${p.grant_id}`} className="underline underline-offset-4">
                        the grant record page
                      </Link>
                      , where you see the grant{p.grant_title ? ` (${p.grant_title})` : ""}.
                    </p>
                  ) : null}
                  {p.status === "proposed" && canEdit ? (
                    <DecideForm proposalId={p.id} canAccept={p.payload.kind !== "stage_move"} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lessons from this session</CardTitle>
          <CardDescription>
            What the next session starts from. {isOpen ? "Closing asks for at least one." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {lessons.length === 0 ? (
            <NotAvailable>No lesson recorded yet.</NotAvailable>
          ) : (
            <ul className="space-y-3 text-sm">
              {lessons.map((l) => (
                <li key={l.id}>
                  <p>{l.lesson}</p>
                  <p className="text-xs text-muted-foreground">
                    {APPLIES_TO_LABELS[l.applies_to]} · evidence: {l.evidence ?? "Not available"}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {session.lessons_summary ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Summary at close: </span>
              {session.lessons_summary}
            </p>
          ) : null}
          {isOpen && canEdit ? (
            <CloseForm sessionId={session.id} hasLessons={lessons.length > 0} pending={pending} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** The item's own text, by kind. Never a claim about interest or eligibility: the importer rejects those. */
function ProposalBody({ payload }: { payload: Record<string, unknown> }) {
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  switch (payload.kind) {
    case "knowledge_fact":
      return (
        <p className="text-sm">
          {text(payload.fact)}{" "}
          <span className="text-muted-foreground">
            (source: {String(payload.source_kind)}, {text(payload.source_ref) ?? "Not available"};
            confidence: {text(payload.confidence) ?? "likely"})
          </span>
        </p>
      );
    case "outreach_draft":
      return (
        <details className="text-sm">
          <summary className="cursor-pointer">Read the draft</summary>
          <pre className="mt-2 rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
            {text(payload.subject) ? `Subject: ${payload.subject}\n\n` : ""}
            {text(payload.body)}
          </pre>
        </details>
      );
    case "task":
      return text(payload.why) ? <p className="text-sm">Why: {text(payload.why)}</p> : null;
    case "stage_move":
      return text(payload.why) ? <p className="text-sm">Why: {text(payload.why)}</p> : null;
    case "lesson":
      return text(payload.evidence_text) ? (
        <p className="text-sm">Evidence: {text(payload.evidence_text)}</p>
      ) : null;
    case "contact":
      return text(payload.source_ref) ? (
        <p className="text-sm text-muted-foreground">Source: {text(payload.source_ref)}</p>
      ) : null;
    default:
      return null;
  }
}
