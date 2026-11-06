/**
 * The results file (docs/learning-session-format.md, section 2): parsing, the importer's rules,
 * and what each accepted item becomes. Pure, so the rules can be checked without a server.
 *
 * File-level problems reject the whole file. Item-level problems reject that item and keep the
 * rest; the caller shows both lists before anything is stored.
 */

import {
  APPLIES_TO,
  CHANNELS,
  CONFIDENCES,
  type Evidence,
  FORBIDDEN_PHRASES,
  GRANT_STAGES,
  ITEM_KINDS,
  type ItemKind,
  MAX_ITEMS,
  MAX_QUOTE_LENGTH,
  PUBLISHABILITY,
  type ProducedBy,
  type ProposalPayload,
  type ResultItem,
  type ResultsFile,
  SCHEMA_VERSION,
  SOURCE_KINDS,
  SUBJECT_KINDS,
} from "./types";

export type ValidationContext = {
  sessionId: string;
  /** Ids of the organization's grants, so a grant reference cannot point elsewhere. */
  grantIds: ReadonlySet<string>;
};

/** One item ready to become a proposal. */
export type PreparedItem = {
  index: number;
  kind: ItemKind;
  summary: string;
  grantId: string | null;
  payload: ProposalPayload;
  sources: Evidence[];
};

export type RejectedItem = { index: number; kind: string; reason: string };

export type ParsedResults =
  | { ok: true; file: ResultsFile; prepared: PreparedItem[]; rejected: RejectedItem[] }
  | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const optText = (v: unknown): string | null => (v === null || v === undefined ? null : text(v));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/** The first forbidden phrase found in any string inside the payload, or null. */
export function findForbiddenPhrase(value: unknown): string | null {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return FORBIDDEN_PHRASES.find((p) => lower.includes(p)) ?? null;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = findForbiddenPhrase(v);
      if (hit) return hit;
    }
    return null;
  }
  if (isObj(value)) return findForbiddenPhrase(Object.values(value));
  return null;
}

function readEvidence(raw: unknown): Evidence[] | string {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return "evidence must be a list";
  const out: Evidence[] = [];
  for (const entry of raw) {
    if (!isObj(entry)) return "each evidence entry must be an object";
    const source_ref = text(entry.source_ref);
    if (!source_ref) return "an evidence entry has no source_ref";
    const quote = typeof entry.quote === "string" ? entry.quote : "";
    if (quote.length > MAX_QUOTE_LENGTH)
      return `an evidence quote is longer than ${MAX_QUOTE_LENGTH} characters`;
    out.push({ source_ref, quote });
  }
  return out;
}

function clip(value: string, max = 240): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function refName(ref: unknown): string | null {
  return isObj(ref) ? (optText(ref.name) ?? optText(ref.title)) : null;
}

function grantIdFrom(ref: unknown, ctx: ValidationContext): string | null | "unknown" {
  if (!isObj(ref)) return null;
  const id = optText(ref.id);
  if (!id) return null;
  return ctx.grantIds.has(id) ? id : "unknown";
}

/** Checks one item's payload and writes its summary; a string is the reason it is rejected. */
function checkItem(
  item: ResultItem,
  ctx: ValidationContext,
): { summary: string; grantId: string | null } | string {
  const p = item.payload;
  switch (item.kind) {
    case "knowledge_fact": {
      const fact = text(p.fact);
      if (!fact) return "a fact needs a non-empty fact";
      if (!SUBJECT_KINDS.includes(p.subject_kind as never)) return "unknown subject_kind";
      if (!SOURCE_KINDS.includes(p.source_kind as never)) return "unknown source_kind";
      if (!text(p.source_ref)) return "a fact needs a source_ref";
      if (p.confidence !== undefined && !CONFIDENCES.includes(p.confidence as never))
        return "unknown confidence";
      const subject = refName(p.subject_ref) ?? String(p.subject_kind);
      return { summary: clip(`Fact about ${subject}: ${fact}`), grantId: null };
    }
    case "contact": {
      const name = text(p.name);
      if (!name) return "a contact needs a name";
      if (p.publishability !== undefined && !PUBLISHABILITY.includes(p.publishability as never))
        return "publishability must be private or public";
      const role = optText(p.role);
      const funder = refName(p.funder_ref);
      return {
        summary: clip(`Contact: ${name}${role ? `, ${role}` : ""}${funder ? ` at ${funder}` : ""}`),
        grantId: null,
      };
    }
    case "outreach_draft": {
      const to = text(p.to_contact_name);
      if (!to) return "a draft needs to_contact_name";
      if (!CHANNELS.includes(p.channel as never))
        return "channel must be email, letter or call_script";
      if (!text(p.body)) return "a draft needs a body";
      const subject = optText(p.subject);
      return {
        summary: clip(
          `Draft ${String(p.channel).replace("_", " ")} to ${to}${subject ? `: ${subject}` : ""}`,
        ),
        grantId: null,
      };
    }
    case "task": {
      const title = text(p.title);
      if (!title) return "a task needs a title";
      if (p.due_at !== undefined && p.due_at !== null && !ISO_DAY.test(String(p.due_at)))
        return "due_at must be an ISO date or null";
      const grantId = grantIdFrom(p.grant_ref, ctx);
      if (grantId === "unknown") return "names a grant this organization does not have";
      return { summary: clip(`Task: ${title}`), grantId };
    }
    case "stage_move": {
      const grantId = grantIdFrom(p.grant_ref, ctx);
      if (grantId === null) return "a stage move needs grant_ref.id";
      if (grantId === "unknown") return "names a grant this organization does not have";
      if (!GRANT_STAGES.includes(p.to_stage as never)) return "unknown to_stage";
      if (
        p.from_stage !== undefined &&
        p.from_stage !== null &&
        !GRANT_STAGES.includes(p.from_stage as never)
      )
        return "unknown from_stage";
      if (!text(p.why)) return "a stage move needs a why";
      const title = refName(p.grant_ref) ?? "the grant";
      return {
        summary: clip(
          `Move "${title}" ${p.from_stage ? `from ${p.from_stage} ` : ""}to ${p.to_stage}`,
        ),
        grantId,
      };
    }
    case "lesson": {
      const lesson = text(p.lesson);
      if (!lesson) return "a lesson needs a lesson";
      if (!APPLIES_TO.includes(p.applies_to as never)) return "unknown applies_to";
      return { summary: clip(`Lesson (${p.applies_to}): ${lesson}`), grantId: null };
    }
  }
}

const NEEDS_EVIDENCE: readonly ItemKind[] = [
  "knowledge_fact",
  "contact",
  "outreach_draft",
  "stage_move",
];

/** Parses and checks a results file against the importer's rules for one open session. */
export function parseResults(raw: string, ctx: ValidationContext): ParsedResults {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }
  if (!isObj(data)) return { ok: false, errors: ["The file must be one JSON object."] };

  const errors: string[] = [];
  if (data.schema_version !== SCHEMA_VERSION)
    errors.push(`schema_version must be ${SCHEMA_VERSION}.`);
  if (data.session_id !== ctx.sessionId)
    errors.push("session_id does not match this open session.");
  const by = isObj(data.produced_by) ? data.produced_by : {};
  const model = text(by.model);
  const date = text(by.date);
  if (!model) errors.push("produced_by.model is missing.");
  if (!date) errors.push("produced_by.date is missing.");
  if (!Array.isArray(data.items)) errors.push("items must be a list.");
  else if (data.items.length === 0) errors.push("items is empty.");
  else if (data.items.length > MAX_ITEMS)
    errors.push(`items holds ${data.items.length}; the format allows at most ${MAX_ITEMS}.`);
  if (errors.length) return { ok: false, errors };

  const produced_by: ProducedBy = {
    tool: text(by.tool) ?? "Not stated",
    model: model!,
    date: date!,
  };
  const summary = text(data.summary) ?? "";
  const prepared: PreparedItem[] = [];
  const rejected: RejectedItem[] = [];

  (data.items as unknown[]).forEach((raw, index) => {
    const kind = isObj(raw) ? String(raw.kind ?? "") : "";
    const reject = (reason: string) => rejected.push({ index, kind: kind || "unknown", reason });
    if (!isObj(raw)) return reject("not an object");
    if (!ITEM_KINDS.includes(kind as ItemKind)) return reject(`unknown kind "${kind}"`);
    if (!isObj(raw.payload)) return reject("payload must be an object");
    const evidence = readEvidence(raw.evidence);
    if (typeof evidence === "string") return reject(evidence);
    const item: ResultItem = { kind: kind as ItemKind, payload: raw.payload, evidence };
    if (NEEDS_EVIDENCE.includes(item.kind) && evidence.length === 0)
      return reject("evidence is empty");
    const phrase = findForbiddenPhrase(item.payload);
    if (phrase) return reject(`the payload says "${phrase}"; say what the record shows instead`);
    const checked = checkItem(item, ctx);
    if (typeof checked === "string") return reject(checked);
    // A lesson's payload has its own `evidence` text; keep it apart from the item's evidence list.
    const own = item.payload.evidence;
    prepared.push({
      index,
      kind: item.kind,
      summary: checked.summary,
      grantId: checked.grantId,
      sources: evidence,
      payload: {
        ...item.payload,
        evidence_text: typeof own === "string" ? own : undefined,
        kind: item.kind,
        source: "ai",
        produced_by,
        item_index: index,
        evidence,
      },
    });
  });

  return {
    ok: true,
    file: {
      schema_version: SCHEMA_VERSION,
      session_id: ctx.sessionId,
      produced_by,
      summary,
      items: prepared.map((p) => ({ kind: p.kind, payload: p.payload, evidence: p.sources })),
    },
    prepared,
    rejected,
  };
}

/** The AI label every imported item shows (honesty rule 2). */
export function aiLabel(by: ProducedBy): string {
  return `AI, ${by.model}, ${by.date}`;
}

function evidenceText(evidence: Evidence[]): string {
  if (evidence.length === 0) return "";
  return evidence.map((e) => `- ${e.source_ref}${e.quote ? `: "${e.quote}"` : ""}`).join("\n");
}

/**
 * The record `accept_learning_proposal` writes for an accepted proposal, built from its stored
 * payload. Null means nothing can be written here (a stage move, or an unknown payload).
 */
export function recordForPayload(payload: ProposalPayload): Record<string, unknown> | null {
  const by = payload.produced_by;
  const label = `Proposed with AI (${by.model}, ${by.date}); accepted by a person.`;
  const evidence = evidenceText(payload.evidence ?? []);
  switch (payload.kind) {
    case "knowledge_fact": {
      const ref = isObj(payload.subject_ref) ? payload.subject_ref : {};
      const id = optText(ref.id);
      return {
        kind: "knowledge_fact",
        subject_kind: payload.subject_kind,
        funder_ref: payload.subject_kind === "funder" ? ref : undefined,
        subject_id: payload.subject_kind !== "funder" && id && UUID.test(id) ? id : null,
        fact: payload.fact,
        source_kind: payload.source_kind,
        source_ref: payload.source_ref,
        confidence: payload.confidence ?? "likely",
      };
    }
    case "contact": {
      const source = optText(payload.source_ref);
      return {
        kind: "contact",
        name: payload.name,
        role: optText(payload.role),
        funder_ref: isObj(payload.funder_ref) ? payload.funder_ref : undefined,
        publishability: payload.publishability ?? "private",
        notes: [source ? `Source: ${source}` : null, label].filter(Boolean).join("\n"),
      };
    }
    case "outreach_draft": {
      const channel = String(payload.channel).replace("_", " ");
      const subject = optText(payload.subject);
      return {
        kind: "outreach_draft",
        title: clip(
          `Send ${channel} to ${payload.to_contact_name}${subject ? `: ${subject}` : ""}`,
          500,
        ),
        description: [
          `${label} Read it, change it, and send it yourself. The app never sends.`,
          "",
          subject ? `Subject: ${subject}` : null,
          String(payload.body),
          evidence ? `\nEvidence:\n${evidence}` : null,
        ]
          .filter((l) => l !== null)
          .join("\n"),
        due_date: null,
      };
    }
    case "task": {
      const due = optText(payload.due_at);
      return {
        kind: "task",
        title: clip(String(payload.title), 500),
        description: [
          label,
          optText(payload.why) ? `Why: ${payload.why}` : null,
          evidence ? `Evidence:\n${evidence}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        due_date: due ? due.slice(0, 10) : null,
      };
    }
    case "lesson":
      return {
        kind: "lesson",
        applies_to: payload.applies_to,
        lesson: payload.lesson,
        evidence: optText(payload.evidence_text) ?? (evidence || null),
      };
    default:
      return null;
  }
}
