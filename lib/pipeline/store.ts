import "server-only";
import type { Enums, Tables, TablesInsert, TablesUpdate } from "@/lib/db/types";
import type { Db } from "./client";
import type { GrantStage } from "./stages";

/**
 * Every database call of the pipeline, in one file. Every function takes the signed-in person's
 * client, so row-level security decides what it can read and write, and the organization id of the
 * page it serves, so a record is never looked up by id alone.
 */

export type Grant = Tables<"grants">;
export type Funder = Tables<"funders">;
export type Proposal = Tables<"proposals">;
export type Note = Tables<"notes">;
export type Task = Tables<"tasks">;
export type Contact = Tables<"contacts">;
export type Deadline = Tables<"deadlines">;
export type ActivityLine = Tables<"activity_log">;
export type StageChange = Tables<"grant_stage_history">;
export type DocumentRow = Tables<"documents">;

export type GrantCard = Grant & {
  funderName: string | null;
  opportunityTitle: string | null;
  openTasks: number;
};

function fail(what: string, error: { message: string }): never {
  throw new Error(`Could not ${what}: ${error.message}`);
}

// Grants ----------------------------------------------------------------------------------------

export async function listGrants(db: Db, organizationId: string): Promise<GrantCard[]> {
  const { data, error } = await db
    .from("grants")
    .select("*")
    .eq("organization_id", organizationId)
    .order("submission_due_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error) fail("load the grants", error);
  const grants = data ?? [];
  const [funders, opportunities, tasks] = await Promise.all([
    listFunders(db, organizationId),
    opportunityTitles(
      db,
      grants.map((g) => g.opportunity_id).filter((id): id is string => id !== null),
    ),
    db
      .from("tasks")
      .select("grant_id")
      .eq("organization_id", organizationId)
      .eq("status", "open")
      .not("grant_id", "is", null),
  ]);
  const funderName = new Map(funders.map((f) => [f.id, f.name]));
  const openTasks = new Map<string, number>();
  for (const task of tasks.data ?? []) {
    if (task.grant_id) openTasks.set(task.grant_id, (openTasks.get(task.grant_id) ?? 0) + 1);
  }
  return grants.map((grant) => ({
    ...grant,
    funderName: grant.funder_id ? (funderName.get(grant.funder_id) ?? null) : null,
    opportunityTitle: grant.opportunity_id
      ? (opportunities.get(grant.opportunity_id) ?? null)
      : null,
    openTasks: openTasks.get(grant.id) ?? 0,
  }));
}

async function opportunityTitles(db: Db, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await db.from("opportunities").select("id, title").in("id", ids);
  return new Map((data ?? []).map((o) => [o.id, o.title]));
}

export type GrantDetail = {
  grant: Grant;
  funder: Funder | null;
  opportunity: Pick<
    Tables<"opportunities">,
    | "id"
    | "title"
    | "funder_name"
    | "close_date"
    | "close_time"
    | "close_time_zone"
    | "source_url"
    | "opportunity_number"
  > | null;
};

export async function getGrant(
  db: Db,
  organizationId: string,
  grantId: string,
): Promise<GrantDetail | null> {
  const { data: grant, error } = await db
    .from("grants")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", grantId)
    .maybeSingle();
  if (error) fail("load the grant", error);
  if (!grant) return null;
  const [funder, opportunity] = await Promise.all([
    grant.funder_id
      ? db
          .from("funders")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("id", grant.funder_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    grant.opportunity_id
      ? db
          .from("opportunities")
          .select(
            "id, title, funder_name, close_date, close_time, close_time_zone, source_url, opportunity_number",
          )
          .eq("id", grant.opportunity_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { grant, funder: funder.data ?? null, opportunity: opportunity.data ?? null };
}

export async function createGrant(db: Db, values: TablesInsert<"grants">): Promise<Grant> {
  const { data, error } = await db.from("grants").insert(values).select("*").single();
  if (error) fail("create the grant", error);
  return data;
}

export async function updateGrant(
  db: Db,
  organizationId: string,
  grantId: string,
  patch: TablesUpdate<"grants">,
): Promise<Grant> {
  const { data, error } = await db
    .from("grants")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", grantId)
    .select("*")
    .maybeSingle();
  if (error) fail("save the grant", error);
  if (!data) throw new Error("Could not save the grant: no row was updated");
  return data;
}

/** A person moves a grant. The stage-history trigger records who and when. */
export async function moveGrant(
  db: Db,
  organizationId: string,
  grantId: string,
  stage: GrantStage,
): Promise<Grant> {
  return updateGrant(db, organizationId, grantId, { stage });
}

// Funders ---------------------------------------------------------------------------------------

export async function listFunders(db: Db, organizationId: string): Promise<Funder[]> {
  const { data, error } = await db
    .from("funders")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) fail("load the funders", error);
  return data ?? [];
}

export async function createFunder(
  db: Db,
  organizationId: string,
  name: string,
  kind: Enums<"funder_kind">,
): Promise<Funder> {
  const { data, error } = await db
    .from("funders")
    .insert({ organization_id: organizationId, name, kind })
    .select("*")
    .single();
  if (error) fail("create the funder", error);
  return data;
}

// The work around a grant ------------------------------------------------------------------------

export async function listNotes(db: Db, organizationId: string, grantId: string): Promise<Note[]> {
  const { data, error } = await db
    .from("notes")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("grant_id", grantId)
    .order("created_at", { ascending: false });
  if (error) fail("load the notes", error);
  return data ?? [];
}

export async function addNote(db: Db, values: TablesInsert<"notes">): Promise<Note> {
  const { data, error } = await db.from("notes").insert(values).select("*").single();
  if (error) fail("add the note", error);
  return data;
}

export async function listTasks(db: Db, organizationId: string, grantId: string): Promise<Task[]> {
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("grant_id", grantId)
    .order("status")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at");
  if (error) fail("load the tasks", error);
  return data ?? [];
}

export async function addTask(db: Db, values: TablesInsert<"tasks">): Promise<Task> {
  const { data, error } = await db.from("tasks").insert(values).select("*").single();
  if (error) fail("add the task", error);
  return data;
}

export async function setTaskStatus(
  db: Db,
  organizationId: string,
  taskId: string,
  status: Enums<"task_status">,
): Promise<Task> {
  const { data, error } = await db
    .from("tasks")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("organization_id", organizationId)
    .eq("id", taskId)
    .select("*")
    .maybeSingle();
  if (error) fail("update the task", error);
  if (!data) throw new Error("Could not update the task: no row was updated");
  return data;
}

export async function listContacts(
  db: Db,
  organizationId: string,
  grantId: string,
  funderId: string | null,
): Promise<Contact[]> {
  let query = db.from("contacts").select("*").eq("organization_id", organizationId);
  query = funderId
    ? query.or(`grant_id.eq.${grantId},funder_id.eq.${funderId}`)
    : query.eq("grant_id", grantId);
  const { data, error } = await query.order("name");
  if (error) fail("load the contacts", error);
  return data ?? [];
}

export async function addContact(db: Db, values: TablesInsert<"contacts">): Promise<Contact> {
  const { data, error } = await db.from("contacts").insert(values).select("*").single();
  if (error) fail("add the contact", error);
  return data;
}

export async function listGrantDeadlines(
  db: Db,
  organizationId: string,
  grantId: string,
): Promise<Deadline[]> {
  const { data, error } = await db
    .from("deadlines")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("grant_id", grantId)
    .order("due_at");
  if (error) fail("load the key dates", error);
  return data ?? [];
}

export async function addDeadline(db: Db, values: TablesInsert<"deadlines">): Promise<Deadline> {
  const { data, error } = await db.from("deadlines").insert(values).select("*").single();
  if (error) fail("add the key date", error);
  return data;
}

export async function listDocuments(
  db: Db,
  organizationId: string,
  grantId: string,
): Promise<DocumentRow[]> {
  const { data, error } = await db
    .from("documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("grant_id", grantId)
    .order("name");
  if (error) fail("load the files", error);
  return data ?? [];
}

// Timeline ---------------------------------------------------------------------------------------

export async function listActivity(
  db: Db,
  organizationId: string,
  grantId: string,
): Promise<ActivityLine[]> {
  const { data, error } = await db
    .from("activity_log")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("grant_id", grantId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) fail("load the timeline", error);
  return data ?? [];
}

export async function listStageHistory(
  db: Db,
  organizationId: string,
  grantId: string,
): Promise<StageChange[]> {
  const { data, error } = await db
    .from("grant_stage_history")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("grant_id", grantId)
    .order("changed_at", { ascending: false });
  if (error) fail("load the stage history", error);
  return data ?? [];
}

/** A line in the activity log, in the signed-in person's name. Never written for an agent here. */
export async function logActivity(
  db: Db,
  values: Omit<TablesInsert<"activity_log">, "actor_kind"> & { actor_id: string },
): Promise<void> {
  const { error } = await db.from("activity_log").insert({ ...values, actor_kind: "person" });
  // A missing log line is reported, never allowed to undo the change it describes.
  if (error)
    console.error("activity_log insert failed", { action: values.action, error: error.message });
}

// Proposals (the propose-only ledger) ---------------------------------------------------------------

export async function listProposals(
  db: Db,
  organizationId: string,
  grantId: string,
): Promise<Proposal[]> {
  const { data, error } = await db
    .from("proposals")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("grant_id", grantId)
    .order("status")
    .order("created_at", { ascending: false });
  if (error) fail("load the proposals", error);
  return data ?? [];
}

export async function getProposal(
  db: Db,
  organizationId: string,
  proposalId: string,
): Promise<Proposal | null> {
  const { data, error } = await db
    .from("proposals")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", proposalId)
    .maybeSingle();
  if (error) fail("load the proposal", error);
  return data;
}

/**
 * The person's decision. The database stamps who and when and refuses a second decision, so two
 * people deciding at once cannot both win.
 */
export async function decideProposal(
  db: Db,
  organizationId: string,
  proposalId: string,
  status: "accepted" | "rejected",
): Promise<Proposal> {
  const { data, error } = await db
    .from("proposals")
    .update({ status })
    .eq("organization_id", organizationId)
    .eq("id", proposalId)
    .eq("status", "proposed")
    .select("*")
    .maybeSingle();
  if (error) fail("record the decision", error);
  if (!data) throw new Error("Could not record the decision: the proposal was already decided");
  return data;
}

/** Profiles of the organization's members, for names on the timeline. */
export async function memberNames(db: Db, userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { data } = await db.from("profiles").select("id, display_name, email").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.display_name || p.email || "A teammate"]));
}
