// Two organizations with one row in every tenant table, created as the table owner (no RLS).
// People: alice owns A, amy is a viewer and ed an editor in A, bob owns B, bea is an editor in B,
// nina belongs to nothing. Each organization has a non-owner member, so a broken memberships policy
// shows up instead of hiding behind the last-owner rule.

import { randomUUID } from "node:crypto";

import { type Db, type Row, insertRow } from "../db/harness";

export const TENANT_TABLES = [
  "funders",
  "opportunities",
  "grants",
  "grant_stage_history",
  "proposals",
  "activity_log",
  "external_feeds",
  "deadlines",
  "tasks",
  "documents",
  "notes",
  "boilerplate",
  "memberships",
] as const;

export type TenantTable = (typeof TENANT_TABLES)[number];

/**
 * Catalog tables (Phase D): public federal reference data and the sync-run log. No organization_id;
 * every signed-in person reads them and only server code writes them.
 */
export const CATALOG_TABLES = [
  "grants_gov_agencies",
  "assistance_listings",
  "opportunity_details",
  "opportunity_sync_runs",
] as const;

/** Every table in public: the tenant tables, the catalog tables, and the two scoped differently. */
export const ALL_PUBLIC_TABLES = [
  ...TENANT_TABLES,
  ...CATALOG_TABLES,
  "organizations",
  "profiles",
] as const;

export interface Org {
  id: string;
  owner: string;
  rows: Record<TenantTable, string>;
  funderId: string;
  grantId: string;
  opportunityId: string;
  feedId: string;
}

export interface World {
  alice: string;
  amy: string;
  ed: string;
  bea: string;
  bob: string;
  nina: string;
  A: Org;
  B: Org;
  catalogOpportunityId: string;
}

export async function createUser(db: Db, email: string): Promise<string> {
  const id = randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  return id;
}

async function createOrg(db: Db, name: string, owner: string): Promise<string> {
  const org = await insertRow(db, "organizations", { name, created_by: owner });
  await insertRow(db, "memberships", { organization_id: org.id, user_id: owner, role: "owner" });
  return org.id as string;
}

/**
 * A row for `table` in organization `org`, written in `as` the given person. Used both for the
 * fixtures and for the write attempts the tests expect to fail.
 */
export function rowFor(
  table: TenantTable,
  org: { id: string; funderId: string; grantId: string; feedId: string },
  person: string,
): Row {
  const tag = randomUUID().slice(0, 8);
  const base = { organization_id: org.id };
  switch (table) {
    case "funders":
      return { ...base, name: `Funder ${tag}`, kind: "foundation", created_by: person };
    case "opportunities":
      return { ...base, title: `Opportunity ${tag}`, status: "open", created_by: person };
    case "grants":
      return { ...base, funder_id: org.funderId, title: `Grant ${tag}`, created_by: person };
    case "grant_stage_history":
      return { ...base, grant_id: org.grantId, to_stage: "awarded", changed_by: person };
    case "proposals":
      return {
        ...base,
        grant_id: org.grantId,
        tool_name: "test",
        summary: `Proposal ${tag}`,
        proposed_by: person,
      };
    case "activity_log":
      return {
        ...base,
        grant_id: org.grantId,
        actor_kind: "person",
        actor_id: person,
        action: "test",
        summary: `Line ${tag}`,
      };
    case "external_feeds":
      return {
        ...base,
        name: `Feed ${tag}`,
        kind: "ical",
        url: `https://example.org/${tag}.ics`,
        created_by: person,
      };
    case "deadlines":
      return {
        ...base,
        grant_id: org.grantId,
        title: `Deadline ${tag}`,
        due_at: "2026-12-16T19:00:00Z",
        created_by: person,
      };
    case "tasks":
      return { ...base, grant_id: org.grantId, title: `Task ${tag}`, created_by: person };
    case "documents":
      return {
        ...base,
        grant_id: org.grantId,
        name: `Doc ${tag}`,
        storage_path: `${org.id}/${tag}.pdf`,
        created_by: person,
      };
    case "notes":
      return { ...base, grant_id: org.grantId, body: `Note ${tag}`, created_by: person };
    case "boilerplate":
      return { ...base, title: `Answer ${tag}`, body: "Our mission.", created_by: person };
    case "memberships":
      // Overridden by callers that need a specific person; a fresh id never matches a real user.
      return { ...base, user_id: person, role: "viewer" };
  }
}

async function fillOrg(db: Db, id: string, owner: string): Promise<Org> {
  const funder = await insertRow(
    db,
    "funders",
    rowFor("funders", { id, funderId: "", grantId: "", feedId: "" }, owner),
  );
  const ref = { id, funderId: funder.id as string, grantId: "", feedId: "" };
  const opportunity = await insertRow(db, "opportunities", rowFor("opportunities", ref, owner));
  const grant = await insertRow(db, "grants", {
    ...rowFor("grants", ref, owner),
    opportunity_id: opportunity.id,
  });
  ref.grantId = grant.id as string;
  const feed = await insertRow(db, "external_feeds", rowFor("external_feeds", ref, owner));
  ref.feedId = feed.id as string;

  const rows: Partial<Record<TenantTable, string>> = {
    funders: ref.funderId,
    opportunities: opportunity.id as string,
    grants: ref.grantId,
    external_feeds: ref.feedId,
  };
  for (const table of [
    "proposals",
    "activity_log",
    "deadlines",
    "tasks",
    "documents",
    "notes",
    "boilerplate",
  ] as const) {
    rows[table] = (await insertRow(db, table, rowFor(table, ref, owner))).id as string;
  }
  // Written by the trigger when the grant was created.
  const [history] = await db.query(
    "select id from public.grant_stage_history where grant_id = $1",
    [ref.grantId],
  );
  rows.grant_stage_history = history.id as string;
  const [membership] = await db.query(
    "select id from public.memberships where organization_id = $1 and user_id = $2",
    [id, owner],
  );
  rows.memberships = membership.id as string;

  return {
    id,
    owner,
    rows: rows as Record<TenantTable, string>,
    funderId: ref.funderId,
    grantId: ref.grantId,
    opportunityId: opportunity.id as string,
    feedId: ref.feedId,
  };
}

export async function buildWorld(db: Db): Promise<World> {
  const alice = await createUser(db, "alice@example.test");
  const amy = await createUser(db, "amy@example.test");
  const ed = await createUser(db, "ed@example.test");
  const bea = await createUser(db, "bea@example.test");
  const bob = await createUser(db, "bob@example.test");
  const nina = await createUser(db, "nina@example.test");

  const aId = await createOrg(db, "Org A", alice);
  const bId = await createOrg(db, "Org B", bob);
  await insertRow(db, "memberships", { organization_id: aId, user_id: amy, role: "viewer" });
  await insertRow(db, "memberships", { organization_id: aId, user_id: ed, role: "editor" });
  await insertRow(db, "memberships", { organization_id: bId, user_id: bea, role: "editor" });

  const A = await fillOrg(db, aId, alice);
  const B = await fillOrg(db, bId, bob);

  const catalog = await insertRow(db, "opportunities", {
    organization_id: null,
    title: "Catalog opportunity",
    status: "forecasted",
    source_system: "test",
    external_id: randomUUID(),
  });

  return { alice, amy, ed, bob, bea, nina, A, B, catalogOpportunityId: catalog.id as string };
}
