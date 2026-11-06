import "server-only";

import type { Tables } from "@/types/supabase";

import { type Db, fail } from "./db";
import { type PacketInput, buildPacket } from "./packet";
import type { Packet, ProposalPayload } from "./types";

export type SessionRow = Tables<"learning_sessions">;
export type FactRow = Tables<"knowledge_facts">;
export type ContactRow = Tables<"contacts">;
export type TouchRow = Tables<"touches">;
export type LessonRow = Tables<"session_lessons">;
export type ProposalRow = Tables<"proposals">;

/** Every read here goes through the person's own client, so it sees only their organization. */

export async function listSessions(db: Db, organizationId: string): Promise<SessionRow[]> {
  const { data, error } = await db
    .from("learning_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("number", { ascending: false });
  if (error) fail("Could not load the sessions", error);
  return data ?? [];
}

export async function getSession(
  db: Db,
  organizationId: string,
  sessionId: string,
): Promise<SessionRow | null> {
  const { data, error } = await db
    .from("learning_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", sessionId)
    .maybeSingle();
  if (error) fail("Could not load the session", error);
  return data;
}

export type LessonWithSession = LessonRow & { session_number: number };

export async function listLessons(db: Db, organizationId: string): Promise<LessonWithSession[]> {
  const { data, error } = await db
    .from("session_lessons")
    .select("*, learning_sessions!inner(number)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) fail("Could not load the lessons", error);
  return (data ?? []).map(({ learning_sessions, ...row }) => ({
    ...row,
    session_number: learning_sessions.number,
  }));
}

export async function listSessionLessons(db: Db, sessionId: string): Promise<LessonRow[]> {
  const { data, error } = await db
    .from("session_lessons")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at");
  if (error) fail("Could not load the lessons", error);
  return data ?? [];
}

export type SessionProposal = Omit<ProposalRow, "payload"> & {
  payload: ProposalPayload;
  grant_title: string | null;
};

/** The proposals imported into one session, oldest first, with the payload typed. */
export async function listSessionProposals(db: Db, sessionId: string): Promise<SessionProposal[]> {
  const { data, error } = await db
    .from("session_proposals")
    .select("created_at, proposals!inner(*, grants(title))")
    .eq("session_id", sessionId)
    .order("created_at");
  if (error) fail("Could not load the proposals", error);
  return (data ?? [])
    .map((link) => link.proposals)
    .filter((p) => p !== null)
    .map(({ grants, ...p }) => ({
      ...p,
      payload: p.payload as unknown as ProposalPayload,
      grant_title: grants?.title ?? null,
    }))
    .sort((a, b) => a.payload.item_index - b.payload.item_index);
}

export async function getSessionProposal(
  db: Db,
  organizationId: string,
  proposalId: string,
): Promise<
  (Omit<ProposalRow, "payload"> & { payload: ProposalPayload; session_id: string }) | null
> {
  const { data, error } = await db
    .from("session_proposals")
    .select("session_id, proposals!inner(*)")
    .eq("organization_id", organizationId)
    .eq("proposal_id", proposalId)
    .maybeSingle();
  if (error) fail("Could not load the proposal", error);
  if (!data?.proposals) return null;
  return {
    ...data.proposals,
    payload: data.proposals.payload as unknown as ProposalPayload,
    session_id: data.session_id,
  };
}

export type Outcome = {
  grant_id: string;
  title: string;
  to_stage: "awarded" | "declined";
  changed_at: string;
};

/**
 * Outcomes after a session opened, for the grants its proposals touched: the first awarded or
 * declined stage change per grant, from the stage history the database writes.
 */
export async function listSessionOutcomes(
  db: Db,
  session: SessionRow,
  proposals: SessionProposal[],
): Promise<Outcome[]> {
  const grantIds = [...new Set(proposals.map((p) => p.grant_id).filter((g): g is string => !!g))];
  if (grantIds.length === 0) return [];
  const { data, error } = await db
    .from("grant_stage_history")
    .select("grant_id, to_stage, changed_at, grants!inner(title)")
    .in("grant_id", grantIds)
    .in("to_stage", ["awarded", "declined"])
    .gte("changed_at", session.opened_at)
    .order("changed_at");
  if (error) fail("Could not load the outcomes", error);
  const seen = new Set<string>();
  const out: Outcome[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.grant_id)) continue;
    seen.add(row.grant_id);
    out.push({
      grant_id: row.grant_id,
      title: row.grants.title,
      to_stage: row.to_stage as "awarded" | "declined",
      changed_at: row.changed_at,
    });
  }
  return out;
}

export type WorkedLesson = LessonWithSession & { grant_title: string };

/** Lessons from sessions that proposed something on a grant that was later awarded. */
export async function listWhatWorked(db: Db, organizationId: string): Promise<WorkedLesson[]> {
  const { data: links, error } = await db
    .from("session_proposals")
    .select("session_id, proposals!inner(grant_id), learning_sessions!inner(number, opened_at)")
    .eq("organization_id", organizationId)
    .not("proposals.grant_id", "is", null);
  if (error) fail("Could not load what worked", error);
  const grantIds = [...new Set((links ?? []).map((l) => l.proposals.grant_id!).filter(Boolean))];
  if (grantIds.length === 0) return [];
  const { data: awards, error: awardsError } = await db
    .from("grant_stage_history")
    .select("grant_id, changed_at, grants!inner(title)")
    .in("grant_id", grantIds)
    .eq("to_stage", "awarded");
  if (awardsError) fail("Could not load the awards", awardsError);
  const awarded = new Map<string, { title: string; changed_at: string }>();
  for (const a of awards ?? [])
    awarded.set(a.grant_id, { title: a.grants.title, changed_at: a.changed_at });
  const winning = new Map<string, string>(); // session id -> grant title
  for (const l of links ?? []) {
    const award = awarded.get(l.proposals.grant_id!);
    if (award && award.changed_at >= l.learning_sessions.opened_at)
      winning.set(l.session_id, award.title);
  }
  if (winning.size === 0) return [];
  const lessons = await listLessons(db, organizationId);
  return lessons
    .filter((l) => winning.has(l.session_id))
    .map((l) => ({ ...l, grant_title: winning.get(l.session_id)! }));
}

export async function listFacts(
  db: Db,
  organizationId: string,
  status: "confirmed" | "all" = "confirmed",
): Promise<FactRow[]> {
  let query = db
    .from("knowledge_facts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (status === "confirmed") query = query.eq("status", "confirmed");
  const { data, error } = await query;
  if (error) fail("Could not load the facts", error);
  return data ?? [];
}

export type ContactWithTouch = ContactRow & {
  funder_name: string | null;
  last_touch_at: string | null;
  last_touch_kind: string | null;
};

export async function listContacts(db: Db, organizationId: string): Promise<ContactWithTouch[]> {
  const { data, error } = await db
    .from("contacts")
    .select("*, funders(name)")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) fail("Could not load the contacts", error);
  const touches = await listTouches(db, organizationId);
  const last = new Map<string, TouchRow>();
  for (const t of touches) if (!last.has(t.contact_id)) last.set(t.contact_id, t);
  return (data ?? []).map(({ funders, ...c }) => ({
    ...c,
    funder_name: funders?.name ?? null,
    last_touch_at: last.get(c.id)?.happened_at ?? null,
    last_touch_kind: last.get(c.id)?.kind ?? null,
  }));
}

export async function listTouches(
  db: Db,
  organizationId: string,
  limit = 200,
): Promise<TouchRow[]> {
  const { data, error } = await db
    .from("touches")
    .select("*")
    .eq("organization_id", organizationId)
    .order("happened_at", { ascending: false })
    .limit(limit);
  if (error) fail("Could not load the touches", error);
  return data ?? [];
}

export async function listFunders(db: Db, organizationId: string) {
  const { data, error } = await db
    .from("funders")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) fail("Could not load the funders", error);
  return data ?? [];
}

export async function listGrants(db: Db, organizationId: string) {
  const { data, error } = await db
    .from("grants")
    .select(
      "id, title, stage, funder_id, amount_requested, amount_awarded, submission_due_at, funders(name)",
    )
    .eq("organization_id", organizationId)
    .order("title");
  if (error) fail("Could not load the grants", error);
  return (data ?? []).map(({ funders, ...g }) => ({ ...g, funder_name: funders?.name ?? null }));
}

/** Reads everything the packet needs and builds it. The session block is stamped by the database. */
export async function buildPacketFor(
  db: Db,
  organization: PacketInput["organization"],
  now = new Date(),
): Promise<Packet> {
  const [facts, grants, deadlinesResult, contacts, touches, lessons] = await Promise.all([
    listFacts(db, organization.id),
    listGrants(db, organization.id),
    db
      .from("deadlines")
      .select("grant_id, title, due_at, kind")
      .eq("organization_id", organization.id)
      .gte("due_at", now.toISOString())
      .order("due_at")
      .limit(100),
    db.from("contacts").select("id, name, role, funder_id").eq("organization_id", organization.id),
    listTouches(db, organization.id, 1000),
    listLessons(db, organization.id),
  ]);
  if (deadlinesResult.error) fail("Could not load the deadlines", deadlinesResult.error);
  if (contacts.error) fail("Could not load the contacts", contacts.error);
  return buildPacket({
    organization,
    facts,
    grants,
    deadlines: deadlinesResult.data ?? [],
    contacts: contacts.data ?? [],
    touches,
    lessons,
    now,
  });
}
