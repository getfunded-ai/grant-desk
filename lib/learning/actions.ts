"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveOrganization } from "@/lib/auth/session";
import type { Json, TablesInsert } from "@/types/supabase";

import { type Db, fail, getDb } from "./db";
import { getPlaybook } from "./playbooks";
import {
  buildPacketFor,
  getSession,
  getSessionProposal,
  listGrants,
  listSessionLessons,
} from "./queries";
import { parseResults, recordForPayload } from "./results";
import {
  APPLIES_TO,
  type AppliesTo,
  CONFIDENCES,
  type Confidence,
  ORGANIZATION_KINDS,
  type OrganizationKind,
  PLAYBOOK_KEYS,
  PLAYBOOKS_FOR_KIND,
  type PlaybookKey,
  PUBLISHABILITY,
  type Publishability,
  SOURCE_KINDS,
  SUBJECT_KINDS,
  type SourceKind,
  type SubjectKind,
  TOUCH_DIRECTIONS,
  TOUCH_KINDS,
  type TouchDirection,
  type TouchKind,
} from "./types";

export type FormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const NOT_CONFIGURED: FormState = {
  status: "error",
  message: "The database is not set up on this copy of Grant Desk yet. See docs/DEPLOY.md.",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readText(formData: FormData, field: string, max = 4000): string {
  return String(formData.get(field) ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

function readId(formData: FormData, field: string): string | null {
  const value = readText(formData, field, 40);
  return UUID.test(value) ? value : null;
}

function readOneOf<T extends string>(
  formData: FormData,
  field: string,
  allowed: readonly T[],
): T | null {
  const value = readText(formData, field, 100);
  return allowed.includes(value as T) ? (value as T) : null;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Database messages are written for people (see the migration); pass the useful part through.
  return message.replace(/^[^:]*: /, "");
}

async function context(): Promise<{
  db: Db;
  organizationId: string;
  organization: Awaited<ReturnType<typeof requireActiveOrganization>>["active"];
} | null> {
  const { active } = await requireActiveOrganization();
  const db = await getDb();
  if (!db) return null;
  return { db, organizationId: active.id, organization: active };
}

/** Change the organization's kind (seeker, funder, company). The database lets only admins do it. */
export async function updateOrganizationKind(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await context();
  if (!ctx) return NOT_CONFIGURED;
  const kind = readOneOf<OrganizationKind>(formData, "kind", ORGANIZATION_KINDS);
  if (!kind) return { status: "error", message: "Pick one of the three kinds." };
  const { data, error } = await ctx.db
    .from("organizations")
    .update({ kind })
    .eq("id", ctx.organizationId)
    .select("id");
  if (error || !data?.length) {
    return {
      status: "error",
      message: "Only an owner or admin can change the organization's kind.",
    };
  }
  revalidatePath("/learning");
  return { status: "success", message: "Saved." };
}

/** Start a session: pick a playbook and a goal, freeze the packet, go to the session page. */
export async function startSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await context();
  if (!ctx) return NOT_CONFIGURED;
  const playbookKey = readOneOf<PlaybookKey>(formData, "playbook", PLAYBOOK_KEYS);
  const goal = readText(formData, "goal", 2000);
  if (!playbookKey) return { status: "error", message: "Pick a playbook." };
  if (goal.length < 3)
    return { status: "error", message: "Write the goal of this session in a sentence." };

  const { data: org, error: orgError } = await ctx.db
    .from("organizations")
    .select("id, name, kind, ein, uei, mission")
    .eq("id", ctx.organizationId)
    .single();
  if (orgError || !org) return { status: "error", message: "Could not load the organization." };
  if (!PLAYBOOKS_FOR_KIND[org.kind].includes(playbookKey)) {
    return { status: "error", message: "That playbook is for another kind of organization." };
  }
  if (!getPlaybook(playbookKey)) return { status: "error", message: "That playbook is missing." };

  let sessionId: string;
  try {
    const packet = await buildPacketFor(ctx.db, org);
    const { data, error } = await ctx.db
      .from("learning_sessions")
      // `number` is set by the database trigger and cannot be sent (no column grant), so the
      // generated Insert type, which lists it as required, is bypassed here on purpose.
      .insert({
        organization_id: ctx.organizationId,
        playbook_key: playbookKey,
        goal,
        packet: packet as unknown as NonNullable<Json>,
      } as unknown as TablesInsert<"learning_sessions">)
      .select("id")
      .single();
    if (error || !data) fail("Could not start the session", error);
    sessionId = data.id;
  } catch (error) {
    console.error("startSession failed", error);
    return { status: "error", message: `Could not start the session: ${errorMessage(error)}` };
  }
  revalidatePath("/learning");
  redirect(`/learning/${sessionId}`);
}

/** Import a results file (pasted or uploaded) into an open session as proposals. */
export async function importResults(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await context();
  if (!ctx) return NOT_CONFIGURED;
  const sessionId = readId(formData, "sessionId");
  if (!sessionId) return { status: "error", message: "Which session?" };
  const session = await getSession(ctx.db, ctx.organizationId, sessionId);
  if (!session) return { status: "error", message: "That session is not in this organization." };
  if (session.status !== "open") return { status: "error", message: "This session is closed." };

  let raw = readText(formData, "results", 2_000_000);
  const file = formData.get("file");
  if (!raw && file instanceof File && file.size > 0) {
    if (file.size > 2_000_000) return { status: "error", message: "The file is larger than 2 MB." };
    raw = (await file.text()).trim();
  }
  if (!raw) return { status: "error", message: "Paste the results JSON or choose the file." };

  const grants = await listGrants(ctx.db, ctx.organizationId);
  const parsed = parseResults(raw, { sessionId, grantIds: new Set(grants.map((g) => g.id)) });
  if (!parsed.ok) return { status: "error", message: `Rejected: ${parsed.errors.join(" ")}` };

  const rejectedNote = parsed.rejected.length
    ? ` Rejected ${parsed.rejected.length}: ${parsed.rejected
        .map((r) => `item ${r.index + 1} (${r.kind}) ${r.reason}`)
        .join("; ")}.`
    : "";
  if (parsed.prepared.length === 0) {
    return { status: "error", message: `No item could be imported.${rejectedNote}` };
  }

  const items = parsed.prepared.map((p) => ({
    tool_name: parsed.file.produced_by.tool.slice(0, 200),
    summary: p.summary,
    payload: p.payload,
    model: parsed.file.produced_by.model,
    sources: p.sources,
    grant_id: p.grantId,
  }));
  const { error } = await ctx.db.rpc("record_learning_proposals", {
    p_session_id: sessionId,
    p_items: items as unknown as Json,
  });
  if (error) {
    console.error("importResults failed", error);
    return { status: "error", message: `Could not store the proposals: ${error.message}` };
  }
  revalidatePath(`/learning/${sessionId}`);
  return {
    status: "success",
    message: `Imported ${parsed.prepared.length} item${parsed.prepared.length === 1 ? "" : "s"} as proposals (${parsed.file.produced_by.model}, ${parsed.file.produced_by.date}).${rejectedNote}`,
  };
}

/** Accept or reject one proposal from a session. Accepting writes the record; rejecting writes nothing. */
export async function decideProposal(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await context();
  if (!ctx) return NOT_CONFIGURED;
  const proposalId = readId(formData, "proposalId");
  const decision = readOneOf(formData, "decision", ["accept", "reject"] as const);
  if (!proposalId || !decision)
    return { status: "error", message: "Which proposal, and which way?" };
  const proposal = await getSessionProposal(ctx.db, ctx.organizationId, proposalId);
  if (!proposal) return { status: "error", message: "That proposal is not in this organization." };
  if (proposal.status !== "proposed")
    return { status: "error", message: "This proposal was already decided." };
  const page = `/learning/${proposal.session_id}`;

  if (decision === "reject") {
    const { data, error } = await ctx.db
      .from("proposals")
      .update({ status: "rejected" })
      .eq("id", proposalId)
      .select("id");
    if (error || !data?.length) {
      return {
        status: "error",
        message: `Could not reject it: ${error?.message ?? "no change was saved"}`,
      };
    }
    revalidatePath(page);
    return { status: "success", message: "Rejected. Nothing was written." };
  }

  if (proposal.payload.kind === "stage_move") {
    return {
      status: "error",
      message: "A stage move is accepted on the grant record page, where you see the grant.",
    };
  }
  const record = recordForPayload(proposal.payload);
  if (!record) return { status: "error", message: "This proposal cannot be written here." };
  const { error } = await ctx.db.rpc("accept_learning_proposal", {
    p_proposal_id: proposalId,
    p_record: record as Json,
  });
  if (error) {
    console.error("decideProposal failed", error);
    return { status: "error", message: `Could not accept it: ${error.message}` };
  }
  revalidatePath(page);
  revalidatePath("/knowledge");
  revalidatePath("/contacts");
  return { status: "success", message: "Accepted and written." };
}

/** Close a session with at least one lesson. */
export async function closeSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await context();
  if (!ctx) return NOT_CONFIGURED;
  const sessionId = readId(formData, "sessionId");
  if (!sessionId) return { status: "error", message: "Which session?" };
  const session = await getSession(ctx.db, ctx.organizationId, sessionId);
  if (!session) return { status: "error", message: "That session is not in this organization." };
  if (session.status !== "open")
    return { status: "error", message: "This session is already closed." };

  const lesson = readText(formData, "lesson");
  const evidence = readText(formData, "evidence");
  const appliesTo = readOneOf<AppliesTo>(formData, "appliesTo", APPLIES_TO) ?? "general";
  const summary = readText(formData, "summary", 4000);
  const existing = await listSessionLessons(ctx.db, sessionId);
  if (!lesson && existing.length === 0) {
    return { status: "error", message: "Write at least one lesson before closing." };
  }
  if (lesson) {
    const { error } = await ctx.db.from("session_lessons").insert({
      organization_id: ctx.organizationId,
      session_id: sessionId,
      applies_to: appliesTo,
      lesson,
      evidence: evidence || null,
    });
    if (error) return { status: "error", message: `Could not save the lesson: ${error.message}` };
  }
  const { data, error } = await ctx.db
    .from("learning_sessions")
    .update({ status: "closed", lessons_summary: summary || null })
    .eq("id", sessionId)
    .select("id");
  if (error || !data?.length) {
    return {
      status: "error",
      message: `Could not close the session: ${error?.message ?? "no change was saved"}`,
    };
  }
  revalidatePath("/learning");
  revalidatePath(`/learning/${sessionId}`);
  return { status: "success", message: "Closed. The next session starts from this one's lessons." };
}

/** A person adds a fact they confirmed themselves, with its source. */
export async function addFact(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await context();
  if (!ctx) return NOT_CONFIGURED;
  const fact = readText(formData, "fact");
  const subjectKind = readOneOf<SubjectKind>(formData, "subjectKind", SUBJECT_KINDS);
  const sourceKind = readOneOf<SourceKind>(formData, "sourceKind", SOURCE_KINDS);
  const sourceRef = readText(formData, "sourceRef", 2000);
  const confidence = readOneOf<Confidence>(formData, "confidence", CONFIDENCES) ?? "stated";
  const subjectId = readId(formData, "subjectId");
  if (!fact || !subjectKind || !sourceKind || !sourceRef) {
    return { status: "error", message: "A fact needs the fact, what it is about, and its source." };
  }
  const { error } = await ctx.db.from("knowledge_facts").insert({
    organization_id: ctx.organizationId,
    subject_kind: subjectKind,
    subject_id: subjectKind === "organization" ? ctx.organizationId : subjectId,
    fact,
    source_kind: sourceKind,
    source_ref: sourceRef,
    confidence,
    status: "confirmed",
  });
  if (error) return { status: "error", message: `Could not save the fact: ${error.message}` };
  revalidatePath("/knowledge");
  return { status: "success", message: "Saved as a confirmed fact." };
}

/** Replace a confirmed fact with a newer one; the old one stays, marked superseded. */
export async function supersedeFact(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await context();
  if (!ctx) return NOT_CONFIGURED;
  const oldId = readId(formData, "factId");
  const fact = readText(formData, "fact");
  const sourceKind = readOneOf<SourceKind>(formData, "sourceKind", SOURCE_KINDS);
  const sourceRef = readText(formData, "sourceRef", 2000);
  const confidence = readOneOf<Confidence>(formData, "confidence", CONFIDENCES) ?? "stated";
  if (!oldId || !fact || !sourceKind || !sourceRef) {
    return { status: "error", message: "The new fact needs its text and its source." };
  }
  const { error } = await ctx.db.rpc("supersede_knowledge_fact", {
    p_old_id: oldId,
    p_fact: fact,
    p_source_kind: sourceKind,
    p_source_ref: sourceRef,
    p_confidence: confidence,
  });
  if (error) return { status: "error", message: `Could not replace the fact: ${error.message}` };
  revalidatePath("/knowledge");
  return { status: "success", message: "Replaced. The old fact stays on record as superseded." };
}

export async function addContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await context();
  if (!ctx) return NOT_CONFIGURED;
  const name = readText(formData, "name", 300);
  if (!name) return { status: "error", message: "A contact needs a name." };
  const funderId = readId(formData, "funderId");
  const publishability =
    readOneOf<Publishability>(formData, "publishability", PUBLISHABILITY) ?? "private";
  const { error } = await ctx.db.from("contacts").insert({
    organization_id: ctx.organizationId,
    name,
    role: readText(formData, "role", 300) || null,
    email: readText(formData, "email", 320) || null,
    phone: readText(formData, "phone", 50) || null,
    funder_id: funderId,
    publishability,
    notes: readText(formData, "notes") || null,
  });
  if (error) return { status: "error", message: `Could not save the contact: ${error.message}` };
  revalidatePath("/contacts");
  return { status: "success", message: "Contact saved." };
}

/** Log a touch by hand. The app records it; it never sends anything. */
export async function logTouch(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await context();
  if (!ctx) return NOT_CONFIGURED;
  const contactId = readId(formData, "contactId");
  const kind = readOneOf<TouchKind>(formData, "kind", TOUCH_KINDS);
  const direction = readOneOf<TouchDirection>(formData, "direction", TOUCH_DIRECTIONS);
  const summary = readText(formData, "summary");
  const happenedAt = readText(formData, "happenedAt", 40);
  const happened = happenedAt ? new Date(happenedAt) : new Date();
  if (!contactId || !kind || !direction || !summary) {
    return {
      status: "error",
      message: "A touch needs the contact, the kind, the direction and a summary.",
    };
  }
  if (Number.isNaN(happened.getTime()))
    return { status: "error", message: "That date is not valid." };
  const { error } = await ctx.db.from("touches").insert({
    organization_id: ctx.organizationId,
    contact_id: contactId,
    grant_id: readId(formData, "grantId"),
    session_id: readId(formData, "sessionId"),
    kind,
    direction,
    happened_at: happened.toISOString(),
    summary,
  });
  if (error) return { status: "error", message: `Could not log the touch: ${error.message}` };
  revalidatePath("/contacts");
  return { status: "success", message: "Touch logged." };
}
