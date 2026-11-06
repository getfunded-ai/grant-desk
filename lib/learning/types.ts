/**
 * The learning-session contract (docs/learning-session-format.md), as TypeScript. Pure: no server
 * imports, so the validator and the packet builder can run anywhere.
 */

export const SCHEMA_VERSION = 1 as const;

export const PLAYBOOK_KEYS = [
  "seeker-prospecting",
  "seeker-outreach",
  "application-prep",
  "post-award-reporting",
  "funder-grantee-outreach",
  "company-nondilutive",
] as const;
export type PlaybookKey = (typeof PLAYBOOK_KEYS)[number];

export const ORGANIZATION_KINDS = ["seeker", "funder", "company"] as const;
export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

export const ORGANIZATION_KIND_LABELS: Record<OrganizationKind, string> = {
  seeker: "Grant seeker (a nonprofit that applies for grants)",
  funder: "Funder (gives grants)",
  company: "Company (seeks non-dilutive funding)",
};

/** Which playbooks fit which kind of organization (format document, section 3). */
export const PLAYBOOKS_FOR_KIND: Record<OrganizationKind, readonly PlaybookKey[]> = {
  seeker: ["seeker-prospecting", "seeker-outreach", "application-prep", "post-award-reporting"],
  funder: ["funder-grantee-outreach"],
  company: ["company-nondilutive", "application-prep", "post-award-reporting"],
};

export const ITEM_KINDS = [
  "knowledge_fact",
  "contact",
  "outreach_draft",
  "task",
  "stage_move",
  "lesson",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  knowledge_fact: "Fact",
  contact: "Contact",
  outreach_draft: "Outreach draft",
  task: "Task",
  stage_move: "Stage move",
  lesson: "Lesson",
};

export const SUBJECT_KINDS = ["organization", "funder", "opportunity", "contact", "grant"] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

export const SOURCE_KINDS = ["filing", "website", "document", "person", "ai"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const CONFIDENCES = ["stated", "likely", "guess"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const APPLIES_TO = [
  "prospecting",
  "outreach",
  "application",
  "post_award",
  "general",
] as const;
export type AppliesTo = (typeof APPLIES_TO)[number];

export const APPLIES_TO_LABELS: Record<AppliesTo, string> = {
  prospecting: "Prospecting",
  outreach: "Outreach",
  application: "Application",
  post_award: "Post-award",
  general: "General",
};

export const TOUCH_KINDS = ["email", "call", "meeting", "letter", "note"] as const;
export type TouchKind = (typeof TOUCH_KINDS)[number];

export const TOUCH_DIRECTIONS = ["out", "in"] as const;
export type TouchDirection = (typeof TOUCH_DIRECTIONS)[number];

export const PUBLISHABILITY = ["private", "public"] as const;
export type Publishability = (typeof PUBLISHABILITY)[number];

export const CHANNELS = ["email", "letter", "call_script"] as const;
export type Channel = (typeof CHANNELS)[number];

export const GRANT_STAGES = [
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
] as const;
export type GrantStage = (typeof GRANT_STAGES)[number];

/** Stages a grant is still being worked in. Declined and closed grants stay out of the packet. */
export const OPEN_STAGES: readonly GrantStage[] = GRANT_STAGES.filter(
  (s) => s !== "declined" && s !== "closed",
);

/** The wording the honesty rules forbid about a funder or an organization (any case). */
export const FORBIDDEN_PHRASES = ["is interested", "is eligible", "will fund"] as const;

/** The producer's limit (format document, "Rules for the producer"). */
export const MAX_ITEMS = 25;
export const MAX_QUOTE_LENGTH = 300;

/** The rules block every packet carries (format document, section 1). */
export const PACKET_RULES = [
  "Facts come only from the packet or from tools; cite each one.",
  "Unknown is not zero or closed: write 'Not available' or 'Not stated in filings'.",
  "Never say a funder is interested or an organization is eligible. Say what the record shows.",
  "Every item is a proposal. A person decides. Nothing is sent.",
  "Label the output as prepared with AI, with model and date.",
] as const;

// Packet (section 1) ----------------------------------------------------------------------------------

export type PacketSession = {
  id: string;
  number: number;
  playbook: PlaybookKey;
  goal: string;
  opened_at: string;
};

export type PacketOrganization = {
  id: string;
  name: string;
  kind: OrganizationKind;
  ein: string | null;
  uei: string | null;
  mission: string | null;
  budget_size: string | null;
  service_area: string | null;
};

export type PacketFact = {
  id: string;
  subject_kind: SubjectKind;
  subject_id: string | null;
  fact: string;
  source_kind: SourceKind;
  source_ref: string;
  confidence: Confidence;
  confirmed_at: string;
};

export type PacketGrant = {
  id: string;
  title: string;
  funder_name: string | null;
  stage: GrantStage;
  amount_asked: number | null;
  amount_awarded: number | null;
  next_deadline: string | null;
};

export type PacketDeadline = {
  grant_id: string | null;
  title: string;
  due_at: string;
  kind: string;
};

export type PacketContact = {
  id: string;
  name: string;
  role: string | null;
  funder_id: string | null;
  last_touch_at: string | null;
  last_touch_kind: string | null;
};

export type PacketLesson = {
  session_number: number;
  applies_to: AppliesTo;
  lesson: string;
  evidence: string;
};

export type Packet = {
  schema_version: typeof SCHEMA_VERSION;
  /** Stamped by the database when the session row is written. Absent in the draft the app builds. */
  session?: PacketSession;
  organization: PacketOrganization;
  knowledge: PacketFact[];
  grants: PacketGrant[];
  deadlines: PacketDeadline[];
  contacts: PacketContact[];
  lessons: PacketLesson[];
  rules: readonly string[];
};

// Results (section 2) ---------------------------------------------------------------------------------

export type Evidence = { source_ref: string; quote: string };

export type ProducedBy = { tool: string; model: string; date: string };

export type ResultItem = {
  kind: ItemKind;
  payload: Record<string, unknown>;
  evidence: Evidence[];
};

export type ResultsFile = {
  schema_version: typeof SCHEMA_VERSION;
  session_id: string;
  produced_by: ProducedBy;
  summary: string;
  items: ResultItem[];
};

/** What is stored in `proposals.payload` for an imported item. */
export type ProposalPayload = {
  kind: ItemKind;
  /** Stays "ai": the item came from an assistant, through a person who imported the file. */
  source: "ai";
  produced_by: ProducedBy;
  item_index: number;
  evidence: Evidence[];
  [field: string]: unknown;
};
