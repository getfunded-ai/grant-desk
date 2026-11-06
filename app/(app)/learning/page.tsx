import Link from "next/link";

import { NotAvailable } from "@/components/learning/ai-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveOrganization } from "@/lib/auth/session";
import { getDb } from "@/lib/learning/db";
import { listPlaybooks } from "@/lib/learning/playbooks";
import { listSessions, listWhatWorked } from "@/lib/learning/queries";
import {
  APPLIES_TO_LABELS,
  ORGANIZATION_KIND_LABELS,
  PLAYBOOKS_FOR_KIND,
  type OrganizationKind,
} from "@/lib/learning/types";

import { KindForm } from "./kind-form";
import { StartSessionForm } from "./start-session-form";

export const metadata = { title: "Learning · Grant Desk" };

const CAN_EDIT = ["owner", "admin", "editor"];
const CAN_ADMIN = ["owner", "admin"];

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "Not available";
}

export default async function LearningPage() {
  const { active } = await requireActiveOrganization();
  const db = await getDb();
  if (!db) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Learning sessions</h1>
        <NotAvailable>The database is not set up on this copy of Grant Desk yet.</NotAvailable>
      </div>
    );
  }
  const [{ data: org }, sessions, worked] = await Promise.all([
    db.from("organizations").select("kind").eq("id", active.id).single(),
    listSessions(db, active.id),
    listWhatWorked(db, active.id),
  ]);
  const kind: OrganizationKind = org?.kind ?? "seeker";
  const playbooks = listPlaybooks().filter((p) => PLAYBOOKS_FOR_KIND[kind].includes(p.key));
  const titles = new Map(listPlaybooks().map((p) => [p.key, p.title]));
  const open = sessions.find((s) => s.status === "open");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Learning sessions</h1>
        <p className="text-sm text-muted-foreground">
          One round of work at a time. Each session starts from a packet of what {active.name} knows
          and what earlier sessions taught. An assistant writes a results file; you accept or reject
          each item. Nothing is sent by the app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start a session</CardTitle>
          <CardDescription>
            {active.name} is set up as: {ORGANIZATION_KIND_LABELS[kind]}.
            {open ? ` Session ${open.number} is still open; close it before starting another.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {CAN_EDIT.includes(active.role) ? (
            <StartSessionForm
              playbooks={playbooks.map((p) => ({ key: p.key, title: p.title, steps: p.steps }))}
              disabled={Boolean(open)}
            />
          ) : (
            <NotAvailable>Only an owner, admin or editor can start a session.</NotAvailable>
          )}
          {CAN_ADMIN.includes(active.role) ? <KindForm kind={kind} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <NotAvailable>No sessions yet. The first one starts above.</NotAvailable>
          ) : (
            <ul className="divide-y">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-sm"
                >
                  <Link
                    href={`/learning/${s.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    Session {s.number}: {titles.get(s.playbook_key) ?? s.playbook_key}
                  </Link>
                  <span className="text-muted-foreground">{s.goal}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {s.status === "open"
                      ? `open since ${day(s.opened_at)}`
                      : `closed ${day(s.closed_at)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What worked</CardTitle>
          <CardDescription>
            Lessons from sessions whose grants were awarded afterwards, as the stage history shows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {worked.length === 0 ? (
            <NotAvailable>
              Not available yet: no grant a session worked on has been marked awarded.
            </NotAvailable>
          ) : (
            <ul className="space-y-3 text-sm">
              {worked.map((l) => (
                <li key={l.id}>
                  <p>{l.lesson}</p>
                  <p className="text-xs text-muted-foreground">
                    Session {l.session_number} · {APPLIES_TO_LABELS[l.applies_to]} · awarded:{" "}
                    {l.grant_title} · evidence: {l.evidence ?? "Not available"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
