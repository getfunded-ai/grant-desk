"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/actions";
import { requireActiveOrganization } from "@/lib/auth/session";
import { isValidTimeZone, zonedToUtc } from "@/lib/calendar/tz";
import { Constants, type Enums } from "@/lib/db/types";
import { userDb, type Db } from "./client";
import { canEdit } from "./permissions";
import { isGrantStage, isPreset, stageLabel, type GrantStage } from "./stages";
import {
  addContact,
  addDeadline,
  addNote,
  addTask,
  createFunder,
  createGrant as insertGrant,
  decideProposal as recordDecision,
  getGrant,
  getProposal,
  logActivity,
  moveGrant,
  setTaskStatus,
  updateGrant,
} from "./store";

const NOT_CONFIGURED: FormState = {
  status: "error",
  message: "The database is not set up on this copy of Grant Desk yet. See docs/DEPLOY.md.",
};
const READ_ONLY: FormState = {
  status: "error",
  message: "Only an owner, admin or editor of this organization can change grants.",
};

type Editor = { db: Db; organizationId: string; userId: string };

/** The signed-in person, their active organization, and a client, if they may write. */
async function requireEditor(): Promise<Editor | FormState> {
  const { user, active } = await requireActiveOrganization();
  if (!canEdit(active.role)) return READ_ONLY;
  const db = await userDb();
  if (!db) return NOT_CONFIGURED;
  return { db, organizationId: active.id, userId: user.id };
}

function isFormState(value: Editor | FormState): value is FormState {
  return "status" in value;
}

function text(formData: FormData, field: string, max = 500): string {
  return String(formData.get(field) ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function longText(formData: FormData, field: string, max = 20000): string {
  return String(formData.get(field) ?? "")
    .trim()
    .slice(0, max);
}

function optional(value: string): string | null {
  return value === "" ? null : value;
}

/** A money field: empty means "not stated" (null), never 0. */
function money(formData: FormData, field: string): number | null | "invalid" {
  const raw = text(formData, field, 30).replace(/[$,\s]/g, "");
  if (raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1e14) return "invalid";
  return Math.round(value * 100) / 100;
}

function dateField(formData: FormData, field: string): string | null | "invalid" {
  const raw = text(formData, field, 10);
  if (raw === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    return "invalid";
  }
  return raw;
}

/**
 * A deadline typed as a local date and time plus a zone, stored as the exact moment. Without a
 * time, the deadline is the end of that day in the zone (23:59), so it never shows a day early.
 */
function dateTimeField(
  formData: FormData,
  dateName: string,
  timeName: string,
  zoneName: string,
): { at: string; zone: string | null; allDay: boolean } | null | "invalid" {
  const date = dateField(formData, dateName);
  if (date === null || date === "invalid") return date;
  const time = text(formData, timeName, 5);
  const zone = text(formData, zoneName, 100);
  if (time !== "" && !/^\d{2}:\d{2}$/.test(time)) return "invalid";
  const resolvedZone = zone !== "" && isValidTimeZone(zone) ? zone : zone === "" ? "UTC" : null;
  if (!resolvedZone) return "invalid";
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = (time || "23:59").split(":").map(Number);
  const at = zonedToUtc(
    { year: y, month: m, day: d, hour: h, minute: mi, second: 0 },
    resolvedZone,
  );
  return { at: at.toISOString(), zone: zone === "" ? null : resolvedZone, allDay: time === "" };
}

function grantFields(formData: FormData): FormState | Record<string, unknown> {
  const title = text(formData, "title", 500);
  if (title.length < 1) return { status: "error", message: "Give the grant a title." };
  const preset = text(formData, "preset", 20) || "standard";
  if (!isPreset(preset)) return { status: "error", message: "Pick a valid preset." };
  const amountRequested = money(formData, "amountRequested");
  const amountAwarded = money(formData, "amountAwarded");
  if (amountRequested === "invalid" || amountAwarded === "invalid") {
    return { status: "error", message: "Amounts must be plain numbers, or left empty." };
  }
  const due = dateTimeField(formData, "dueDate", "dueTime", "dueZone");
  const decision = dateField(formData, "decisionDate");
  const awardStart = dateField(formData, "awardStartDate");
  const awardEnd = dateField(formData, "awardEndDate");
  if (
    due === "invalid" ||
    decision === "invalid" ||
    awardStart === "invalid" ||
    awardEnd === "invalid"
  ) {
    return { status: "error", message: "Dates must be YYYY-MM-DD and times HH:MM." };
  }
  if (awardStart && awardEnd && awardStart > awardEnd) {
    return { status: "error", message: "The award cannot end before it starts." };
  }
  return {
    title,
    preset,
    amount_requested: amountRequested,
    amount_awarded: amountAwarded,
    submission_due_at: due?.at ?? null,
    decision_date: decision,
    award_start_date: awardStart,
    award_end_date: awardEnd,
  };
}

async function resolveFunder(
  editor: Editor,
  formData: FormData,
): Promise<{ funderId: string | null; created: boolean } | FormState> {
  const funderId = text(formData, "funderId", 36);
  const newName = text(formData, "newFunderName", 300);
  if (funderId !== "" && funderId !== "new") return { funderId, created: false };
  if (newName === "") return { funderId: null, created: false };
  const kind = text(formData, "newFunderKind", 20);
  const kinds = Constants.public.Enums.funder_kind as readonly string[];
  const funder = await createFunder(
    editor.db,
    editor.organizationId,
    newName,
    (kinds.includes(kind) ? kind : "other") as Enums<"funder_kind">,
  );
  return { funderId: funder.id, created: true };
}

/** Create a grant by hand (Phase D's "Track this" creates one from an opportunity). */
export async function createGrant(_prev: FormState, formData: FormData): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  const fields = grantFields(formData);
  if ("status" in fields) return fields as FormState;

  let grantId: string;
  try {
    const funder = await resolveFunder(editor, formData);
    if ("status" in funder) return funder;
    if (!funder.funderId) {
      return { status: "error", message: "Pick a funder or type the name of a new one." };
    }
    const grant = await insertGrant(editor.db, {
      ...fields,
      organization_id: editor.organizationId,
      funder_id: funder.funderId,
      title: fields.title as string,
    });
    grantId = grant.id;
    await logActivity(editor.db, {
      organization_id: editor.organizationId,
      grant_id: grant.id,
      actor_id: editor.userId,
      action: "grant.created",
      summary: `Created the grant in stage ${stageLabel(grant.stage, grant.preset)}.`,
    });
  } catch (error) {
    console.error("createGrant failed", error);
    return { status: "error", message: "We could not create the grant. Try again." };
  }
  revalidatePath("/grants");
  revalidatePath("/calendar");
  redirect(`/grants/${grantId}`);
}

export async function updateGrantDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  const grantId = text(formData, "grantId", 36);
  const fields = grantFields(formData);
  if ("status" in fields) return fields as FormState;
  try {
    const funder = await resolveFunder(editor, formData);
    if ("status" in funder) return funder;
    const before = await getGrant(editor.db, editor.organizationId, grantId);
    if (!before) return { status: "error", message: "This grant no longer exists." };
    await updateGrant(editor.db, editor.organizationId, grantId, {
      ...fields,
      funder_id: funder.funderId ?? before.grant.funder_id,
    });
    await logActivity(editor.db, {
      organization_id: editor.organizationId,
      grant_id: grantId,
      actor_id: editor.userId,
      action: "grant.updated",
      summary: "Edited the grant details.",
    });
  } catch (error) {
    console.error("updateGrantDetails failed", error);
    return { status: "error", message: "We could not save the grant. Try again." };
  }
  revalidatePath("/grants");
  revalidatePath(`/grants/${grantId}`);
  revalidatePath("/calendar");
  redirect(`/grants/${grantId}`);
}

/** A person moves a grant to a stage (board drag, or the stage menu on the record). */
export async function moveGrantStage(grantId: string, stage: string): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  if (!isGrantStage(stage)) return { status: "error", message: "That is not a pipeline stage." };
  try {
    const before = await getGrant(editor.db, editor.organizationId, grantId);
    if (!before) return { status: "error", message: "This grant no longer exists." };
    if (before.grant.stage === stage) return { status: "idle" };
    const grant = await moveGrant(editor.db, editor.organizationId, grantId, stage);
    await logActivity(editor.db, {
      organization_id: editor.organizationId,
      grant_id: grantId,
      actor_id: editor.userId,
      action: "stage.moved",
      summary: `Moved from ${stageLabel(before.grant.stage, grant.preset)} to ${stageLabel(stage, grant.preset)}.`,
      details: { from_stage: before.grant.stage, to_stage: stage },
    });
  } catch (error) {
    console.error("moveGrantStage failed", error);
    return { status: "error", message: "We could not move the grant. Try again." };
  }
  revalidatePath("/grants");
  revalidatePath(`/grants/${grantId}`);
  revalidatePath("/calendar");
  return { status: "success", message: "Moved." };
}

export async function createNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  const grantId = text(formData, "grantId", 36);
  const body = longText(formData, "body");
  if (body === "") return { status: "error", message: "Write something first." };
  try {
    await addNote(editor.db, { organization_id: editor.organizationId, grant_id: grantId, body });
    await logActivity(editor.db, {
      organization_id: editor.organizationId,
      grant_id: grantId,
      actor_id: editor.userId,
      action: "note.added",
      summary: "Added a note.",
    });
  } catch (error) {
    console.error("createNote failed", error);
    return { status: "error", message: "We could not add the note. Try again." };
  }
  revalidatePath(`/grants/${grantId}`);
  return { status: "success", message: "Note added." };
}

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  const grantId = text(formData, "grantId", 36);
  const title = text(formData, "title", 500);
  const dueDate = dateField(formData, "dueDate");
  if (title === "") return { status: "error", message: "Give the task a title." };
  if (dueDate === "invalid")
    return { status: "error", message: "The due date must be YYYY-MM-DD." };
  try {
    await addTask(editor.db, {
      organization_id: editor.organizationId,
      grant_id: grantId,
      title,
      due_date: dueDate,
    });
    await logActivity(editor.db, {
      organization_id: editor.organizationId,
      grant_id: grantId,
      actor_id: editor.userId,
      action: "task.added",
      summary: `Added the task "${title}".`,
    });
  } catch (error) {
    console.error("createTask failed", error);
    return { status: "error", message: "We could not add the task. Try again." };
  }
  revalidatePath(`/grants/${grantId}`);
  revalidatePath("/calendar");
  return { status: "success", message: "Task added." };
}

export async function toggleTask(
  taskId: string,
  grantId: string,
  done: boolean,
): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  try {
    const task = await setTaskStatus(
      editor.db,
      editor.organizationId,
      taskId,
      done ? "done" : "open",
    );
    await logActivity(editor.db, {
      organization_id: editor.organizationId,
      grant_id: grantId,
      actor_id: editor.userId,
      action: done ? "task.done" : "task.reopened",
      summary: `${done ? "Finished" : "Reopened"} the task "${task.title}".`,
    });
  } catch (error) {
    console.error("toggleTask failed", error);
    return { status: "error", message: "We could not update the task. Try again." };
  }
  revalidatePath(`/grants/${grantId}`);
  revalidatePath("/calendar");
  return { status: "idle" };
}

export async function createContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  const grantId = text(formData, "grantId", 36);
  const name = text(formData, "name", 300);
  if (name === "") return { status: "error", message: "Give the contact a name." };
  const email = text(formData, "email", 254);
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Enter a valid email address, or leave it empty." };
  }
  try {
    await addContact(editor.db, {
      organization_id: editor.organizationId,
      grant_id: grantId,
      name,
      role: optional(text(formData, "role", 200)),
      email: optional(email.toLowerCase()),
      phone: optional(text(formData, "phone", 50)),
    });
  } catch (error) {
    console.error("createContact failed", error);
    return { status: "error", message: "We could not add the contact. Try again." };
  }
  revalidatePath(`/grants/${grantId}`);
  return { status: "success", message: "Contact added." };
}

export async function createDeadline(_prev: FormState, formData: FormData): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  const grantId = text(formData, "grantId", 36);
  const title = text(formData, "title", 500);
  if (title === "") return { status: "error", message: "Give the key date a title." };
  const kind = text(formData, "kind", 20);
  const kinds = Constants.public.Enums.deadline_kind as readonly string[];
  const due = dateTimeField(formData, "dueDate", "dueTime", "dueZone");
  if (!due || due === "invalid") {
    return {
      status: "error",
      message: "Enter the date as YYYY-MM-DD, the time as HH:MM and a known time zone.",
    };
  }
  try {
    await addDeadline(editor.db, {
      organization_id: editor.organizationId,
      grant_id: grantId,
      title,
      kind: (kinds.includes(kind) ? kind : "other") as Enums<"deadline_kind">,
      due_at: due.at,
      all_day: due.allDay,
      time_zone: due.zone,
    });
    await logActivity(editor.db, {
      organization_id: editor.organizationId,
      grant_id: grantId,
      actor_id: editor.userId,
      action: "deadline.added",
      summary: `Added the key date "${title}".`,
    });
  } catch (error) {
    console.error("createDeadline failed", error);
    return { status: "error", message: "We could not add the key date. Try again." };
  }
  revalidatePath(`/grants/${grantId}`);
  revalidatePath("/calendar");
  return { status: "success", message: "Key date added." };
}

/**
 * The person's decision on a proposal (honesty rule 3). Accepting a stage-move proposal is the only
 * way a proposal moves a stage, and the move is made here, by the person, after the ledger has
 * recorded their decision.
 */
export async function decideProposal(
  proposalId: string,
  decision: "accepted" | "rejected",
): Promise<FormState> {
  const editor = await requireEditor();
  if (isFormState(editor)) return editor;
  let grantId: string | null = null;
  try {
    const proposal = await getProposal(editor.db, editor.organizationId, proposalId);
    if (!proposal) return { status: "error", message: "This proposal no longer exists." };
    grantId = proposal.grant_id;
    const decided = await recordDecision(editor.db, editor.organizationId, proposalId, decision);
    await logActivity(editor.db, {
      organization_id: editor.organizationId,
      grant_id: grantId,
      actor_id: editor.userId,
      action: `proposal.${decision}`,
      summary: `${decision === "accepted" ? "Accepted" : "Rejected"} the proposal from ${decided.tool_name}: ${decided.summary}`,
      details: { proposal_id: proposalId },
    });
    if (decision === "accepted" && grantId) {
      const payload = decided.payload as { kind?: unknown; to_stage?: unknown };
      if (payload.kind === "stage_move") {
        if (!isGrantStage(payload.to_stage)) {
          return {
            status: "error",
            message:
              "Accepted, but the proposal names a stage that does not exist, so nothing moved.",
          };
        }
        const moved = await moveGrantStage(grantId, payload.to_stage as GrantStage);
        if (moved.status === "error") return moved;
      }
    }
  } catch (error) {
    console.error("decideProposal failed", error);
    return { status: "error", message: "We could not record the decision. Try again." };
  }
  revalidatePath("/grants");
  if (grantId) revalidatePath(`/grants/${grantId}`);
  return { status: "success", message: decision === "accepted" ? "Accepted." : "Rejected." };
}
