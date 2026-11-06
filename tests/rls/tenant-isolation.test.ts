// The data wall: a member of organization A cannot read or write organization B on any tenant table,
// a person with no organization sees nothing, a viewer cannot write, and anonymous callers get nothing.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Db, type Row, as, attempt, insertSql, openDb } from "../db/harness";
import {
  ALL_PUBLIC_TABLES,
  CATALOG_KEY_COLUMN,
  type Org,
  TENANT_TABLES,
  type TenantTable,
  type World,
  buildWorld,
  rowFor,
} from "./fixtures";

let db: Db;
let world: World;

beforeAll(async () => {
  db = await openDb();
  world = await buildWorld(db);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

// Owner rows are protected by the last-owner rule too; aim the memberships checks at the other
// members so only row-level security can stop them.
const NOT_OWNER: Partial<Record<TenantTable, string>> = { memberships: "and role <> 'owner'" };

// One column per table that the authenticated role may update, and a value for it.
const TOUCH: Record<TenantTable, [string, unknown]> = {
  funders: ["name", "changed"],
  opportunities: ["title", "changed"],
  grants: ["stage", "awarded"],
  grant_stage_history: ["to_stage", "closed"],
  proposals: ["status", "accepted"],
  activity_log: ["summary", "changed"],
  external_feeds: ["name", "changed"],
  deadlines: ["title", "changed"],
  tasks: ["title", "changed"],
  documents: ["name", "changed"],
  notes: ["body", "changed"],
  boilerplate: ["title", "changed"],
  awards: ["award_number", "changed"],
  award_reports: ["title", "changed"],
  budget_lines: ["category", "changed"],
  budget_actuals: ["description", "changed"],
  reimbursements: ["invoice_number", "changed"],
  compliance_items: ["title", "changed"],
  feed_items: ["title", "changed"],
  calendar_tokens: ["label", "changed"],
  reminder_preferences: ["mode", "off"],
  reminder_log: ["days_before", 99],
  contacts: ["name", "changed"],
  knowledge_facts: ["status", "superseded"],
  learning_sessions: ["lessons_summary", "changed"],
  touches: ["summary", "changed"],
  session_lessons: ["lesson", "changed"],
  session_proposals: ["created_at", "2020-01-01T00:00:00Z"],
  memberships: ["role", "viewer"],
};

/** A fingerprint of every row an organization has in a table, read as the owner (no RLS). */
async function fingerprint(table: string, orgId: string): Promise<string> {
  const column = table === "organizations" ? "id" : "organization_id";
  const [row] = await db.query<{ fp: string | null; n: number }>(
    `select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id), '')) as fp, count(*)::int as n
     from public.${table} t where t.${column} = $1`,
    [orgId],
  );
  return `${row.n}:${row.fp}`;
}

function intruderCases(): Array<[string, () => { me: string; mine: Org; theirs: Org }]> {
  return [
    ["alice (owner of A) against B", () => ({ me: world.alice, mine: world.A, theirs: world.B })],
    ["bob (owner of B) against A", () => ({ me: world.bob, mine: world.B, theirs: world.A })],
  ];
}

describe.each(intruderCases())("%s", (_label, who) => {
  it.each(TENANT_TABLES)("reads only its own rows of %s", async (table) => {
    const { me, mine, theirs } = who();
    const rows = await as(db, { role: "authenticated", userId: me }, () =>
      db.query<{ id: string; organization_id: string | null }>(
        `select id, organization_id from public.${table}`,
      ),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(mine.rows[table]);
    expect(ids).not.toContain(theirs.rows[table]);
    for (const row of rows) {
      // Only the shared opportunity catalog has no organization.
      if (table === "opportunities" && row.organization_id === null) continue;
      expect(row.organization_id).toBe(mine.id);
    }
  });

  it.each(TENANT_TABLES)("cannot insert into the other organization's %s", async (table) => {
    const { me, theirs } = who();
    const before = await fingerprint(table, theirs.id);
    const values =
      table === "memberships"
        ? { organization_id: theirs.id, user_id: me, role: "owner" }
        : rowFor(table, theirs, me);
    const result = await as(db, { role: "authenticated", userId: me }, () =>
      attempt(db, ...insertSql(table, values)),
    );
    expect(result.error?.message).toMatch(/row-level security|permission denied/);
    expect(await fingerprint(table, theirs.id)).toBe(before);
  });

  it.each(TENANT_TABLES)("cannot update the other organization's %s", async (table) => {
    const { me, theirs } = who();
    const [column, value] = TOUCH[table];
    const before = await fingerprint(table, theirs.id);
    const after = await as(db, { role: "authenticated", userId: me }, async () => {
      const result = await attempt(
        db,
        `update public.${table} set ${column} = $1 where organization_id = $2 ${NOT_OWNER[table] ?? ""} returning id`,
        [value, theirs.id],
      );
      if (result.rows) expect(result.rows).toHaveLength(0);
      await db.exec("reset role");
      return fingerprint(table, theirs.id);
    });
    expect(after).toBe(before);
  });

  it.each(TENANT_TABLES)("cannot delete the other organization's %s", async (table) => {
    const { me, theirs } = who();
    const before = await fingerprint(table, theirs.id);
    const after = await as(db, { role: "authenticated", userId: me }, async () => {
      const result = await attempt(
        db,
        `delete from public.${table} where organization_id = $1 ${NOT_OWNER[table] ?? ""} returning id`,
        [theirs.id],
      );
      if (result.rows) expect(result.rows).toHaveLength(0);
      await db.exec("reset role");
      return fingerprint(table, theirs.id);
    });
    expect(after).toBe(before);
  });

  it("cannot read, update or delete the other organization itself", async () => {
    const { me, mine, theirs } = who();
    const before = await fingerprint("organizations", theirs.id);
    const { visible, after } = await as(db, { role: "authenticated", userId: me }, async () => {
      const visible = (await db.query<{ id: string }>("select id from public.organizations")).map(
        (r) => r.id,
      );
      const update = await attempt(
        db,
        "update public.organizations set name = 'changed' where id = $1 returning id",
        [theirs.id],
      );
      if (update.rows) expect(update.rows).toHaveLength(0);
      const del = await attempt(db, "delete from public.organizations where id = $1 returning id", [
        theirs.id,
      ]);
      expect(del.error?.message).toMatch(/permission denied/);
      await db.exec("reset role");
      return { visible, after: await fingerprint("organizations", theirs.id) };
    });
    expect(visible).toEqual([mine.id]);
    expect(after).toBe(before);
  });

  it("cannot read or change the other organization's people's profiles", async () => {
    const { me, theirs } = who();
    const before = await db.query("select * from public.profiles where id = $1", [theirs.owner]);
    const { visible, after } = await as(db, { role: "authenticated", userId: me }, async () => {
      const visible = (await db.query<{ id: string }>("select id from public.profiles")).map(
        (r) => r.id,
      );
      const update = await attempt(
        db,
        "update public.profiles set display_name = 'changed' where id = $1 returning id",
        [theirs.owner],
      );
      if (update.rows) expect(update.rows).toHaveLength(0);
      await db.exec("reset role");
      return {
        visible,
        after: await db.query("select * from public.profiles where id = $1", [theirs.owner]),
      };
    });
    expect(visible).toContain(me);
    expect(visible).not.toContain(theirs.owner);
    expect(after).toEqual(before);
  });
});

describe("a signed-in person with no organization", () => {
  it.each([...TENANT_TABLES, "organizations"] as const)("sees no rows of %s", async (table) => {
    const rows = await as(db, { role: "authenticated", userId: world.nina }, () =>
      db.query<Row>(
        table === "opportunities"
          ? "select id from public.opportunities where organization_id is not null"
          : `select id from public.${table}`,
      ),
    );
    expect(rows).toEqual([]);
  });

  it("sees only their own profile", async () => {
    const rows = await as(db, { role: "authenticated", userId: world.nina }, () =>
      db.query<{ id: string }>("select id from public.profiles"),
    );
    expect(rows.map((r) => r.id)).toEqual([world.nina]);
  });
});

describe("a viewer", () => {
  // Rows the authenticated role can never insert, whoever asks, are covered by the next block. A
  // viewer may set their own reminder preference (and only their own: feeds.test.ts).
  const WRITABLE = TENANT_TABLES.filter(
    (t) => t !== "grant_stage_history" && t !== "reminder_log" && t !== "reminder_preferences",
  );

  it.each(WRITABLE)("cannot insert into %s of their own organization", async (table) => {
    const values =
      table === "memberships"
        ? { organization_id: world.A.id, user_id: world.nina, role: "viewer" }
        : rowFor(table, world.A, world.amy);
    const result = await as(db, { role: "authenticated", userId: world.amy }, () =>
      attempt(db, ...insertSql(table, values)),
    );
    expect(result.error?.message).toMatch(/row-level security|permission denied/);
  });

  it.each(TENANT_TABLES)("cannot update or delete %s of their own organization", async (table) => {
    const [column, value] = TOUCH[table];
    const before = await fingerprint(table, world.A.id);
    const after = await as(db, { role: "authenticated", userId: world.amy }, async () => {
      // A viewer may delete their own membership (leave); exclude it so the check is about others.
      const filter =
        table === "memberships" ? `and user_id <> '${world.amy}' and role <> 'owner'` : "";
      const update = await attempt(
        db,
        `update public.${table} set ${column} = $1 where organization_id = $2 ${filter} returning id`,
        [value, world.A.id],
      );
      if (update.rows) expect(update.rows).toHaveLength(0);
      const del = await attempt(
        db,
        `delete from public.${table} where organization_id = $1 ${filter} returning id`,
        [world.A.id],
      );
      if (del.rows) expect(del.rows).toHaveLength(0);
      await db.exec("reset role");
      return fingerprint(table, world.A.id);
    });
    expect(after).toBe(before);
  });
});

describe("an owner in their own organization (the positive control)", () => {
  // Stage history is written only by its trigger; members are added only by create_organization or
  // server code (see rules.test.ts); the reminder log only by server code after a real send, and a
  // reminder preference is one row per person, which the fixtures already hold (feeds.test.ts).
  const INSERTABLE = TENANT_TABLES.filter(
    (t) =>
      t !== "grant_stage_history" &&
      t !== "memberships" &&
      t !== "reminder_log" &&
      t !== "reminder_preferences",
  );

  it.each(INSERTABLE)("can insert into %s", async (table) => {
    const values = rowFor(table, world.A, world.alice);
    const result = await as(db, { role: "authenticated", userId: world.alice }, () =>
      attempt(db, ...insertSql(table, values)),
    );
    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(1);
  });

  it("can never write stage history by hand", async () => {
    const result = await as(db, { role: "authenticated", userId: world.alice }, () =>
      attempt(
        db,
        ...insertSql("grant_stage_history", rowFor("grant_stage_history", world.A, world.alice)),
      ),
    );
    expect(result.error?.message).toMatch(/permission denied/);
  });
});

describe("anonymous callers", () => {
  it.each(ALL_PUBLIC_TABLES)("cannot read %s", async (table) => {
    const result = await as(db, { role: "anon" }, () =>
      attempt(db, `select * from public.${table}`),
    );
    expect(result.error?.message).toMatch(/permission denied/);
  });

  it.each(TENANT_TABLES)("cannot insert into %s", async (table) => {
    const result = await as(db, { role: "anon" }, () =>
      attempt(db, ...insertSql(table, rowFor(table, world.A, world.alice))),
    );
    expect(result.error?.message).toMatch(/permission denied/);
  });

  it.each(ALL_PUBLIC_TABLES)("cannot update or delete %s", async (table) => {
    const key = (CATALOG_KEY_COLUMN as Record<string, string>)[table] ?? "id";
    const update = await as(db, { role: "anon" }, () =>
      attempt(db, `update public.${table} set ${key} = ${key}`),
    );
    expect(update.error?.message).toMatch(/permission denied/);
    const del = await as(db, { role: "anon" }, () => attempt(db, `delete from public.${table}`));
    expect(del.error?.message).toMatch(/permission denied/);
  });

  it("cannot create an organization or call the membership helpers", async () => {
    const create = await as(db, { role: "anon" }, () =>
      attempt(db, "select public.create_organization('Sneaky')"),
    );
    expect(create.error?.message).toMatch(/permission denied/);
    const helper = await as(db, { role: "anon" }, () =>
      attempt(db, "select private.is_member($1)", [world.A.id]),
    );
    expect(helper.error?.message).toMatch(/permission denied/);
  });
});
