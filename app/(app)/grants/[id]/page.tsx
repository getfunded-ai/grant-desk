import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContactForm,
  DeadlineForm,
  NoteForm,
  ProposalButtons,
  StageMenu,
  TaskCheckbox,
  TaskForm,
} from "@/components/pipeline/record-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveOrganization } from "@/lib/auth/session";
import { DEADLINE_KIND_LABELS } from "@/lib/calendar/events";
import { userDb } from "@/lib/pipeline/client";
import { formatDate, formatDateTime, formatMoney, NOT_STATED } from "@/lib/pipeline/format";
import { canEdit } from "@/lib/pipeline/permissions";
import { PRESET_LABELS, stageLabel, type GrantStage } from "@/lib/pipeline/stages";
import {
  getGrant,
  listActivity,
  listContacts,
  listDocuments,
  listGrantDeadlines,
  listNotes,
  listProposals,
  listStageHistory,
  listTasks,
  memberNames,
} from "@/lib/pipeline/store";

export const metadata = { title: "Grant · Grant Desk" };

export default async function GrantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { active } = await requireActiveOrganization();
  const db = await userDb();
  if (!db) notFound();
  const detail = await getGrant(db, active.id, id);
  if (!detail) notFound();
  const { grant, funder, opportunity } = detail;
  const editor = canEdit(active.role);

  const [notes, tasks, contacts, deadlines, documents, activity, history, proposals] =
    await Promise.all([
      listNotes(db, active.id, id),
      listTasks(db, active.id, id),
      listContacts(db, active.id, id, grant.funder_id),
      listGrantDeadlines(db, active.id, id),
      listDocuments(db, active.id, id),
      listActivity(db, active.id, id),
      listStageHistory(db, active.id, id),
      listProposals(db, active.id, id),
    ]);
  const names = await memberNames(db, [
    ...activity.map((a) => a.actor_id).filter((v): v is string => v !== null),
    ...history.map((h) => h.changed_by).filter((v): v is string => v !== null),
    ...notes.map((n) => n.created_by).filter((v): v is string => v !== null),
    ...proposals.map((p) => p.decided_by).filter((v): v is string => v !== null),
  ]);
  const nameOf = (userId: string | null) =>
    userId ? (names.get(userId) ?? "A teammate") : "Someone";
  const open = proposals.filter((p) => p.status === "proposed");
  const decided = proposals.filter((p) => p.status !== "proposed");

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/grants" className="text-sm text-muted-foreground hover:text-foreground">
          ← All grants
        </Link>
        <div className="flex flex-wrap items-start gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{grant.title}</h1>
            <p className="text-sm text-muted-foreground">
              {funder
                ? funder.name
                : opportunity?.funder_name
                  ? opportunity.funder_name
                  : "Funder not stated"}
              {" · "}
              {PRESET_LABELS[grant.preset]} labels
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {editor ? (
              <StageMenu grantId={grant.id} stage={grant.stage} preset={grant.preset} />
            ) : (
              <span className="text-sm">Stage: {stageLabel(grant.stage, grant.preset)}</span>
            )}
            {editor ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/grants/${grant.id}/edit`}>Edit</Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href={`/grants/${grant.id}/award`}>Award</Link>
            </Button>
          </div>
        </div>
      </div>

      {open.length > 0 ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Proposals waiting for a decision</CardTitle>
            <CardDescription>
              A tool or an agent suggested these. Nothing changes until a person accepts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {open.map((proposal) => (
                <li key={proposal.id} className="space-y-2 rounded-md border p-3 text-sm">
                  <ProposalSummary proposal={proposal} preset={grant.preset} />
                  {editor ? <ProposalButtons proposalId={proposal.id} /> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Funder</dt>
              <dd>
                {funder ? (
                  <>
                    {funder.name}
                    {funder.website ? (
                      <>
                        {" · "}
                        <a
                          href={funder.website}
                          className="underline underline-offset-4"
                          rel="noreferrer"
                        >
                          website
                        </a>
                      </>
                    ) : null}
                  </>
                ) : (
                  NOT_STATED
                )}
              </dd>
              <dt className="text-muted-foreground">Amount asked</dt>
              <dd>{formatMoney(grant.amount_requested, grant.currency)}</dd>
              <dt className="text-muted-foreground">Amount awarded</dt>
              <dd>{formatMoney(grant.amount_awarded, grant.currency)}</dd>
              <dt className="text-muted-foreground">Submission due</dt>
              <dd>{formatDateTime(grant.submission_due_at)}</dd>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd>{formatDateTime(grant.submitted_at)}</dd>
              <dt className="text-muted-foreground">Decision expected</dt>
              <dd>{formatDate(grant.decision_date)}</dd>
              <dt className="text-muted-foreground">Award period</dt>
              <dd>
                {grant.award_start_date || grant.award_end_date
                  ? `${formatDate(grant.award_start_date)} to ${formatDate(grant.award_end_date)}`
                  : NOT_STATED}
              </dd>
              {opportunity ? (
                <>
                  <dt className="text-muted-foreground">Opportunity</dt>
                  <dd>
                    {opportunity.source_url ? (
                      <a
                        href={opportunity.source_url}
                        className="underline underline-offset-4"
                        rel="noreferrer"
                      >
                        {opportunity.title}
                      </a>
                    ) : (
                      opportunity.title
                    )}
                    {opportunity.opportunity_number ? ` (${opportunity.opportunity_number})` : ""}
                    {opportunity.close_date ? (
                      <span className="block text-muted-foreground">
                        Closes {formatDate(opportunity.close_date)}
                        {opportunity.close_time ? ` at ${opportunity.close_time.slice(0, 5)}` : ""}
                        {opportunity.close_time_zone ? ` ${opportunity.close_time_zone}` : ""}
                      </span>
                    ) : null}
                  </dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key dates</CardTitle>
            <CardDescription>On the calendar and in reminder emails.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No key dates yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {deadlines.map((d) => (
                  <li key={d.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {d.title}
                      <span className="text-muted-foreground">
                        {" "}
                        · {DEADLINE_KIND_LABELS[d.kind]}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {formatDateTime(d.due_at, d.time_zone, d.all_day)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {editor ? <DeadlineForm grantId={grant.id} defaultZone="America/New_York" /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    {editor ? (
                      <TaskCheckbox
                        taskId={t.id}
                        grantId={grant.id}
                        done={t.status === "done"}
                        title={t.title}
                      />
                    ) : null}
                    <span
                      className={t.status === "done" ? "text-muted-foreground line-through" : ""}
                    >
                      {t.title}
                    </span>
                    {t.due_date ? (
                      <span className="ml-auto text-muted-foreground">
                        {formatDate(t.due_date)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {editor ? <TaskForm grantId={grant.id} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>People on this grant and at its funder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.name}</span>
                    {c.role ? <span className="text-muted-foreground"> · {c.role}</span> : null}
                    <span className="block text-muted-foreground">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {editor ? <ContactForm grantId={grant.id} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription>
              Uploads arrive with documents (Phase F); the list is ready for them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {documents.map((d) => (
                  <li key={d.id}>
                    {d.name}
                    <span className="text-muted-foreground"> · version {d.version}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editor ? <NoteForm grantId={grant.id} /> : null}
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {notes.map((n) => (
                  <li key={n.id} className="space-y-1">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {nameOf(n.created_by)} · {formatDateTime(n.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            Every stage change and action, with who did it and when.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Timeline
            entries={[
              ...history.map((h) => ({
                id: `stage-${h.id}`,
                at: h.changed_at,
                who: nameOf(h.changed_by),
                text: h.from_stage
                  ? `Stage: ${stageLabel(h.from_stage as GrantStage, grant.preset)} → ${stageLabel(h.to_stage, grant.preset)}`
                  : `Created in stage ${stageLabel(h.to_stage, grant.preset)}`,
              })),
              ...activity
                .filter((a) => a.action !== "stage.moved" && a.action !== "grant.created")
                .map((a) => ({
                  id: `activity-${a.id}`,
                  at: a.created_at,
                  who:
                    a.actor_kind === "person"
                      ? nameOf(a.actor_id)
                      : a.actor_kind === "agent"
                        ? "An agent"
                        : "The system",
                  text: a.summary,
                })),
              ...decided.map((p) => ({
                id: `proposal-${p.id}`,
                at: p.decided_at ?? p.created_at,
                who: nameOf(p.decided_by),
                text: `${p.status === "accepted" ? "Accepted" : "Rejected"} a proposal from ${p.tool_name}: ${p.summary}`,
              })),
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ProposalSummary({
  proposal,
  preset,
}: {
  proposal: {
    tool_name: string;
    summary: string;
    model: string | null;
    created_at: string;
    payload: unknown;
    sources: unknown;
  };
  preset: "standard" | "sbir";
}) {
  const payload = (proposal.payload ?? {}) as { kind?: unknown; to_stage?: unknown };
  const sources = Array.isArray(proposal.sources) ? proposal.sources : [];
  return (
    <div className="space-y-1">
      <p>{proposal.summary}</p>
      {payload.kind === "stage_move" && typeof payload.to_stage === "string" ? (
        <p className="text-muted-foreground">
          Accepting moves the grant to{" "}
          {isStage(payload.to_stage)
            ? stageLabel(payload.to_stage, preset)
            : `"${payload.to_stage}" (not a known stage)`}
          .
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        From {proposal.tool_name}
        {proposal.model ? ` (AI, model ${proposal.model})` : ""} on{" "}
        {formatDateTime(proposal.created_at)}.
        {sources.length > 0
          ? ` Evidence: ${sources.map((s) => (typeof s === "string" ? s : JSON.stringify(s))).join("; ")}`
          : " No sources given."}
      </p>
    </div>
  );
}

function isStage(value: string): value is GrantStage {
  return [
    "prospect",
    "qualifying",
    "loi",
    "application",
    "submitted",
    "awarded",
    "declined",
    "active",
    "reporting",
    "closed",
  ].includes(value);
}

function Timeline({
  entries,
}: {
  entries: { id: string; at: string; who: string; text: string }[];
}) {
  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at));
  if (sorted.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <ol className="space-y-2 text-sm">
      {sorted.map((entry) => (
        <li key={entry.id} className="grid gap-x-4 sm:grid-cols-[12rem_1fr]">
          <span className="text-muted-foreground">{formatDateTime(entry.at)}</span>
          <span>
            <span className="font-medium">{entry.who}</span> · {entry.text}
          </span>
        </li>
      ))}
    </ol>
  );
}
