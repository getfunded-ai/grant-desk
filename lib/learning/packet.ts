/**
 * The packet (docs/learning-session-format.md, section 1). `buildPacket` turns rows into the JSON
 * the database freezes; `renderPacketMarkdown` turns a frozen packet into the file a person pastes
 * into any assistant. Pure, so both can be checked without a server.
 */

import {
  type AppliesTo,
  type Confidence,
  type GrantStage,
  OPEN_STAGES,
  type OrganizationKind,
  PACKET_RULES,
  type Packet,
  type PacketContact,
  type PacketDeadline,
  type PacketFact,
  type PacketGrant,
  type PacketLesson,
  SCHEMA_VERSION,
  type SourceKind,
  type SubjectKind,
} from "./types";

export const NOT_AVAILABLE = "Not available";
export const NOT_STATED = "Not stated in filings";

/** How far back a touch keeps a contact in the packet. */
export const CONTACT_WINDOW_DAYS = 90;

export type PacketInput = {
  organization: {
    id: string;
    name: string;
    kind: OrganizationKind;
    ein: string | null;
    uei: string | null;
    mission: string | null;
  };
  facts: Array<{
    id: string;
    subject_kind: SubjectKind;
    subject_id: string | null;
    fact: string;
    source_kind: SourceKind;
    source_ref: string;
    confidence: Confidence;
    confirmed_at: string | null;
  }>;
  grants: Array<{
    id: string;
    title: string;
    stage: GrantStage;
    funder_id: string | null;
    funder_name: string | null;
    amount_requested: number | string | null;
    amount_awarded: number | string | null;
    submission_due_at: string | null;
  }>;
  deadlines: Array<{ grant_id: string | null; title: string; due_at: string; kind: string }>;
  contacts: Array<{ id: string; name: string; role: string | null; funder_id: string | null }>;
  touches: Array<{ contact_id: string; kind: string; happened_at: string }>;
  lessons: Array<{
    session_number: number;
    applies_to: AppliesTo;
    lesson: string;
    evidence: string | null;
  }>;
  now: Date;
};

function money(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Everything the exporter rules ask for, from rows the caller already read under row-level security. */
export function buildPacket(input: PacketInput): Packet {
  const now = input.now.getTime();
  const since = now - CONTACT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const knowledge: PacketFact[] = input.facts
    .filter((f) => f.confirmed_at)
    .sort((a, b) => (a.confirmed_at! < b.confirmed_at! ? 1 : -1))
    .map((f) => ({
      id: f.id,
      subject_kind: f.subject_kind,
      subject_id: f.subject_id,
      fact: f.fact,
      source_kind: f.source_kind,
      source_ref: f.source_ref,
      confidence: f.confidence,
      confirmed_at: f.confirmed_at!,
    }));

  const upcoming = input.deadlines
    .filter((d) => new Date(d.due_at).getTime() >= now)
    .sort((a, b) => (a.due_at < b.due_at ? -1 : 1));

  const openGrants = input.grants.filter((g) => OPEN_STAGES.includes(g.stage));
  const grants: PacketGrant[] = openGrants.map((g) => {
    const first = upcoming.find((d) => d.grant_id === g.id)?.due_at ?? null;
    const submission =
      g.submission_due_at && new Date(g.submission_due_at).getTime() >= now
        ? g.submission_due_at
        : null;
    const next = [first, submission].filter((d): d is string => Boolean(d)).sort()[0] ?? null;
    return {
      id: g.id,
      title: g.title,
      funder_name: g.funder_name,
      stage: g.stage,
      amount_asked: money(g.amount_requested),
      amount_awarded: money(g.amount_awarded),
      next_deadline: next,
    };
  });

  const deadlines: PacketDeadline[] = upcoming.map((d) => ({
    grant_id: d.grant_id,
    title: d.title,
    due_at: d.due_at,
    kind: d.kind,
  }));

  const lastTouch = new Map<string, { kind: string; happened_at: string }>();
  for (const t of input.touches) {
    const seen = lastTouch.get(t.contact_id);
    if (!seen || seen.happened_at < t.happened_at)
      lastTouch.set(t.contact_id, { kind: t.kind, happened_at: t.happened_at });
  }
  const openFunders = new Set(openGrants.map((g) => g.funder_id).filter(Boolean));
  const contacts: PacketContact[] = input.contacts
    .filter((c) => {
      const touch = lastTouch.get(c.id);
      const recent = touch ? new Date(touch.happened_at).getTime() >= since : false;
      return recent || (c.funder_id !== null && openFunders.has(c.funder_id));
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      funder_id: c.funder_id,
      last_touch_at: lastTouch.get(c.id)?.happened_at ?? null,
      last_touch_kind: lastTouch.get(c.id)?.kind ?? null,
    }));

  const lessons: PacketLesson[] = [...input.lessons]
    .sort((a, b) => b.session_number - a.session_number)
    .map((l) => ({
      session_number: l.session_number,
      applies_to: l.applies_to,
      lesson: l.lesson,
      evidence: l.evidence ?? NOT_AVAILABLE,
    }));

  return {
    schema_version: SCHEMA_VERSION,
    organization: {
      id: input.organization.id,
      name: input.organization.name,
      kind: input.organization.kind,
      ein: input.organization.ein,
      uei: input.organization.uei,
      mission: input.organization.mission,
      // Not recorded on the organization yet; a confirmed fact can carry them.
      budget_size: null,
      service_area: null,
    },
    knowledge,
    grants,
    deadlines,
    contacts,
    lessons,
    rules: PACKET_RULES,
  };
}

function show(value: string | number | null | undefined, missing = NOT_AVAILABLE): string {
  if (value === null || value === undefined || value === "") return missing;
  return String(value);
}

function usd(value: number | null): string {
  if (value === null) return NOT_AVAILABLE;
  return `US$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : NOT_AVAILABLE;
}

/**
 * The Markdown packet: a readable part for people (with the playbook text), then the same content
 * as one JSON block for tools. `playbook` is the playbook's Markdown body; `playbookTitle` its title.
 */
export function renderPacketMarkdown(
  packet: Packet,
  playbook: { title: string; body: string },
): string {
  const s = packet.session;
  const o = packet.organization;
  const lines: string[] = [];
  lines.push(`# Learning session ${s ? s.number : "(draft)"}: ${playbook.title}`);
  lines.push("");
  lines.push(`Organization: ${o.name} (${o.kind})`);
  lines.push(`Goal: ${s?.goal ?? NOT_AVAILABLE}`);
  lines.push(`Opened: ${s?.opened_at ?? NOT_AVAILABLE}`);
  lines.push(`Session id: ${s?.id ?? NOT_AVAILABLE}`);
  lines.push("");
  lines.push("Prepared by Grant Desk. Every fact below carries its source. Answer with a results");
  lines.push("file (JSON) for this session id, as the format document describes. A person accepts");
  lines.push("or rejects each item. Nothing is sent by the app.");
  lines.push("");
  lines.push("## Rules");
  lines.push("");
  for (const rule of packet.rules) lines.push(`- ${rule}`);
  lines.push("");
  lines.push("## Organization");
  lines.push("");
  lines.push(`- Name: ${o.name}`);
  lines.push(`- Kind: ${o.kind}`);
  lines.push(`- EIN: ${show(o.ein, NOT_STATED)}`);
  lines.push(`- UEI: ${show(o.uei, NOT_STATED)}`);
  lines.push(`- Mission: ${show(o.mission)}`);
  lines.push(`- Budget size: ${show(o.budget_size)}`);
  lines.push(`- Service area: ${show(o.service_area)}`);
  lines.push("");
  lines.push("## What the organization knows (confirmed facts, newest first)");
  lines.push("");
  if (packet.knowledge.length === 0) lines.push(`${NOT_AVAILABLE}: no confirmed facts yet.`);
  for (const f of packet.knowledge)
    lines.push(
      `- [${f.subject_kind}] ${f.fact} (source: ${f.source_kind}, ${f.source_ref}; confidence: ${f.confidence}; confirmed ${day(f.confirmed_at)})`,
    );
  lines.push("");
  lines.push("## Open grants");
  lines.push("");
  if (packet.grants.length === 0) lines.push(`${NOT_AVAILABLE}: no open grants.`);
  for (const g of packet.grants)
    lines.push(
      `- ${g.title} · funder: ${show(g.funder_name)} · stage: ${g.stage} · asked: ${usd(g.amount_asked)} · awarded: ${usd(g.amount_awarded)} · next deadline: ${day(g.next_deadline)} · id: ${g.id}`,
    );
  lines.push("");
  lines.push("## Upcoming deadlines");
  lines.push("");
  if (packet.deadlines.length === 0) lines.push(`${NOT_AVAILABLE}: no upcoming deadlines.`);
  for (const d of packet.deadlines)
    lines.push(
      `- ${day(d.due_at)} · ${d.title} (${d.kind})${d.grant_id ? ` · grant ${d.grant_id}` : ""}`,
    );
  lines.push("");
  lines.push("## Contacts (recent, or on open grants; no private details)");
  lines.push("");
  if (packet.contacts.length === 0) lines.push(`${NOT_AVAILABLE}: no contacts in the window.`);
  for (const c of packet.contacts)
    lines.push(
      `- ${c.name}${c.role ? `, ${c.role}` : ""} · last touch: ${c.last_touch_at ? `${day(c.last_touch_at)} (${c.last_touch_kind})` : NOT_AVAILABLE}`,
    );
  lines.push("");
  lines.push("## Lessons from earlier sessions (newest first)");
  lines.push("");
  if (packet.lessons.length === 0) lines.push("None yet: this is the first session.");
  for (const l of packet.lessons)
    lines.push(
      `- Session ${l.session_number} (${l.applies_to}): ${l.lesson} · Evidence: ${l.evidence}`,
    );
  lines.push("");
  lines.push(`## Playbook: ${playbook.title}`);
  lines.push("");
  lines.push(playbook.body);
  lines.push("");
  lines.push("## Data");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(packet, null, 2));
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}
