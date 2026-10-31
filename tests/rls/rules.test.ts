// The rules inside one organization: creating an organization, managing members, records that cannot
// be attached across the data wall, the propose-only ledger, stage history, the activity log, the
// shared opportunity catalog and deletion.

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Db, as, attempt, insertRow, insertSql, openDb } from "../db/harness";
import { type World, buildWorld, createUser, rowFor } from "./fixtures";

let db: Db;
let world: World;

beforeAll(async () => {
  db = await openDb();
  world = await buildWorld(db);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const asUser = <T>(userId: string, fn: () => Promise<T>) =>
  as(db, { role: "authenticated", userId }, fn);

describe("creating an organization", () => {
  it("creates it and makes the caller its only owner", async () => {
    const { orgId, visible, members } = await asUser(world.nina, async () => {
      const [{ id: orgId }] = await db.query<{ id: string }>(
        "select public.create_organization('Nina Org') as id",
      );
      const visible = await db.query<{ name: string }>("select name from public.organizations");
      const members = await db.query<{ user_id: string; role: string }>(
        "select user_id, role from public.memberships",
      );
      return { orgId, visible, members };
    });
    expect(orgId).toMatch(/^[0-9a-f-]{36}$/);
    expect(visible.map((o) => o.name)).toEqual(["Nina Org"]);
    expect(members).toEqual([{ user_id: world.nina, role: "owner" }]);
  });

  it("is refused without a signed-in person", async () => {
    const result = await as(db, { role: "authenticated", userId: null }, () =>
      attempt(db, "select public.create_organization('Nobody')"),
    );
    expect(result.error?.message).toMatch(/sign in/);
  });

  it("cannot be done by inserting into organizations directly", async () => {
    const result = await asUser(world.nina, () =>
      attempt(db, "insert into public.organizations (name) values ('Direct')"),
    );
    expect(result.error?.message).toMatch(/permission denied/);
  });
});

describe("members and roles", () => {
  it("a viewer cannot promote themselves", async () => {
    const rows = await asUser(world.amy, async () => {
      const result = await attempt(
        db,
        "update public.memberships set role = 'owner' where user_id = $1 returning id",
        [world.amy],
      );
      return result.rows ?? [];
    });
    expect(rows).toEqual([]);
  });

  it("nobody adds a member with a signed-in session, not even an owner", async () => {
    // Otherwise anyone could pull a stranger into an organization they never chose to join.
    const result = await asUser(world.alice, () =>
      attempt(
        db,
        ...insertSql("memberships", {
          organization_id: world.A.id,
          user_id: world.nina,
          role: "viewer",
        }),
      ),
    );
    expect(result.error?.message).toMatch(/permission denied/);
  });

  it("an admin changes members' roles but cannot touch an owner", async () => {
    const admin = await createUser(db, `admin-${randomUUID()}@example.test`);
    await insertRow(db, "memberships", {
      organization_id: world.A.id,
      user_id: admin,
      role: "admin",
    });
    const { editor, owner, promote } = await asUser(admin, async () => ({
      editor: await attempt(
        db,
        "update public.memberships set role = 'editor' where user_id = $1 and organization_id = $2 returning id",
        [world.amy, world.A.id],
      ),
      owner: await attempt(
        db,
        "update public.memberships set role = 'viewer' where user_id = $1 and organization_id = $2 returning id",
        [world.alice, world.A.id],
      ),
      promote: await attempt(
        db,
        "update public.memberships set role = 'owner' where user_id = $1 and organization_id = $2 returning id",
        [world.amy, world.A.id],
      ),
    }));
    await db.query("delete from public.memberships where user_id = $1", [admin]);
    expect(editor.rows).toHaveLength(1);
    expect(owner.rows).toEqual([]);
    expect(promote.error?.message).toMatch(/row-level security/);
  });

  it("the last owner cannot leave or step down", async () => {
    const { leave, demote } = await asUser(world.alice, async () => ({
      leave: await attempt(
        db,
        "delete from public.memberships where user_id = $1 and organization_id = $2",
        [world.alice, world.A.id],
      ),
      demote: await attempt(
        db,
        "update public.memberships set role = 'admin' where user_id = $1 and organization_id = $2",
        [world.alice, world.A.id],
      ),
    }));
    expect(leave.error?.message).toMatch(/at least one owner/);
    expect(demote.error?.message).toMatch(/at least one owner/);
  });

  it("a member can leave", async () => {
    const rows = await asUser(world.amy, async () => {
      const result = await attempt(
        db,
        "delete from public.memberships where user_id = $1 returning id",
        [world.amy],
      );
      return result.rows ?? [];
    });
    expect(rows).toHaveLength(1);
  });

  it("a person sees the profiles of people in a shared organization", async () => {
    const ids = await asUser(world.alice, async () =>
      (await db.query<{ id: string }>("select id from public.profiles")).map((r) => r.id),
    );
    expect(ids.sort()).toEqual([world.alice, world.amy, world.ed].sort());
  });

  it("a person can change their display name but not their email", async () => {
    const { name, email } = await asUser(world.alice, async () => ({
      name: await attempt(
        db,
        "update public.profiles set display_name = 'Alice' where id = $1 returning id",
        [world.alice],
      ),
      email: await attempt(
        db,
        "update public.profiles set email = 'x@example.test' where id = $1",
        [world.alice],
      ),
    }));
    expect(name.rows).toHaveLength(1);
    expect(email.error?.message).toMatch(/permission denied/);
  });
});

describe("records cannot be attached across the data wall", () => {
  it("a grant cannot use another organization's funder", async () => {
    const result = await asUser(world.alice, () =>
      attempt(
        db,
        ...insertSql("grants", {
          ...rowFor("grants", world.A, world.alice),
          funder_id: world.B.funderId,
        }),
      ),
    );
    expect(result.error?.message).toMatch(/foreign key/);
  });

  it("a grant cannot use another organization's opportunity, but can use the catalog", async () => {
    const { theirs, catalog } = await asUser(world.alice, async () => ({
      theirs: await attempt(
        db,
        ...insertSql("grants", {
          ...rowFor("grants", world.A, world.alice),
          opportunity_id: world.B.opportunityId,
        }),
      ),
      catalog: await attempt(
        db,
        ...insertSql("grants", {
          ...rowFor("grants", world.A, world.alice),
          opportunity_id: world.catalogOpportunityId,
        }),
      ),
    }));
    expect(theirs.error?.message).toMatch(/another organization/);
    expect(catalog.error).toBeUndefined();
  });

  it.each([
    "proposals",
    "activity_log",
    "deadlines",
    "tasks",
    "documents",
    "notes",
    "grant_stage_history",
  ] as const)("%s cannot point at another organization's grant", async (table) => {
    // As the owner role (no RLS), to prove the foreign key itself holds even for server code.
    const result = await attempt(
      db,
      ...insertSql(table, { ...rowFor(table, world.A, world.alice), grant_id: world.B.grantId }),
    );
    expect(result.error?.message).toMatch(/foreign key/);
  });

  it("a note cannot point at another organization's funder", async () => {
    const result = await attempt(
      db,
      ...insertSql("notes", {
        ...rowFor("notes", world.A, world.alice),
        grant_id: null,
        funder_id: world.B.funderId,
      }),
    );
    expect(result.error?.message).toMatch(/foreign key/);
  });

  it("a deadline cannot point at another organization's feed", async () => {
    const result = await attempt(
      db,
      ...insertSql("deadlines", {
        ...rowFor("deadlines", world.A, world.alice),
        external_feed_id: world.B.feedId,
      }),
    );
    expect(result.error?.message).toMatch(/foreign key/);
  });

  it("a task can be assigned only to a member of its organization", async () => {
    const { outsider, member } = await asUser(world.alice, async () => ({
      outsider: await attempt(
        db,
        ...insertSql("tasks", { ...rowFor("tasks", world.A, world.alice), assignee_id: world.bob }),
      ),
      member: await attempt(
        db,
        ...insertSql("tasks", { ...rowFor("tasks", world.A, world.alice), assignee_id: world.amy }),
      ),
    }));
    expect(outsider.error?.message).toMatch(/foreign key/);
    expect(member.error).toBeUndefined();
  });

  it("a record cannot be moved to another organization, even by a member of both", async () => {
    await insertRow(db, "memberships", {
      organization_id: world.B.id,
      user_id: world.alice,
      role: "owner",
    });
    const results = await asUser(world.alice, async () => {
      const out: Record<string, string | undefined> = {};
      for (const table of ["funders", "grants", "boilerplate", "external_feeds"] as const) {
        const r = await attempt(
          db,
          `update public.${table} set organization_id = $1 where id = $2`,
          [world.B.id, world.A.rows[table]],
        );
        out[table] = r.error?.message;
      }
      return out;
    });
    await db.query("delete from public.memberships where organization_id = $1 and user_id = $2", [
      world.B.id,
      world.alice,
    ]);
    for (const message of Object.values(results))
      expect(message).toMatch(/organization_id cannot change/);
  });
});

describe("the proposals ledger (AI and agents propose, people decide)", () => {
  it("a proposal must start as proposed", async () => {
    const result = await asUser(world.alice, () =>
      attempt(
        db,
        ...insertSql("proposals", {
          ...rowFor("proposals", world.A, world.alice),
          status: "accepted",
        }),
      ),
    );
    expect(result.error?.message).toMatch(
      /permission denied|row-level security|starts as proposed/,
    );
  });

  it("a person decides once and the decision is stamped", async () => {
    const { decided, again } = await asUser(world.alice, async () => {
      const [decided] = await db.query<{
        status: string;
        decided_by: string;
        decided_at: string | null;
      }>(
        "update public.proposals set status = 'accepted' where id = $1 returning status, decided_by, decided_at",
        [world.A.rows.proposals],
      );
      const again = await attempt(
        db,
        "update public.proposals set status = 'rejected' where id = $1",
        [world.A.rows.proposals],
      );
      return { decided, again };
    });
    expect(decided.status).toBe("accepted");
    expect(decided.decided_by).toBe(world.alice);
    expect(decided.decided_at).not.toBeNull();
    expect(again.error?.message).toMatch(/already decided/);
  });

  it("the content of a proposal cannot change and proposals cannot be deleted", async () => {
    const { edit, del } = await asUser(world.alice, async () => ({
      edit: await attempt(db, "update public.proposals set summary = 'rewritten' where id = $1", [
        world.A.rows.proposals,
      ]),
      del: await attempt(db, "delete from public.proposals where id = $1", [
        world.A.rows.proposals,
      ]),
    }));
    expect(edit.error?.message).toMatch(/permission denied/);
    expect(del.error?.message).toMatch(/permission denied/);
  });

  it("even server code cannot rewrite a proposal's content while deciding it", async () => {
    const result = await attempt(
      db,
      "update public.proposals set status = 'accepted', payload = '{\"x\":1}' where id = $1",
      [world.B.rows.proposals],
    );
    expect(result.error?.message).toMatch(/only the decision/);
  });
});

describe("grant stage history", () => {
  it("records every stage change with who made it", async () => {
    const history = await asUser(world.alice, async () => {
      await db.query("update public.grants set stage = 'qualifying' where id = $1", [
        world.A.grantId,
      ]);
      await db.query("update public.grants set title = 'Renamed' where id = $1", [world.A.grantId]);
      await db.query("update public.grants set stage = 'application' where id = $1", [
        world.A.grantId,
      ]);
      return db.query<{ from_stage: string | null; to_stage: string; changed_by: string | null }>(
        "select from_stage, to_stage, changed_by from public.grant_stage_history where grant_id = $1 order by changed_at",
        [world.A.grantId],
      );
    });
    expect(history.map((h) => [h.from_stage, h.to_stage])).toEqual([
      [null, "prospect"],
      ["prospect", "qualifying"],
      ["qualifying", "application"],
    ]);
    expect(history.slice(1).every((h) => h.changed_by === world.alice)).toBe(true);
  });

  it("cannot be edited or deleted by a person", async () => {
    const { edit, del } = await asUser(world.alice, async () => ({
      edit: await attempt(db, "update public.grant_stage_history set to_stage = 'awarded'"),
      del: await attempt(db, "delete from public.grant_stage_history"),
    }));
    expect(edit.error?.message).toMatch(/permission denied/);
    expect(del.error?.message).toMatch(/permission denied/);
  });
});

describe("the activity log", () => {
  it("a person writes lines only in their own name", async () => {
    const { mine, agent, someoneElse } = await asUser(world.alice, async () => ({
      mine: await attempt(
        db,
        ...insertSql("activity_log", rowFor("activity_log", world.A, world.alice)),
      ),
      agent: await attempt(
        db,
        ...insertSql("activity_log", {
          ...rowFor("activity_log", world.A, world.alice),
          actor_kind: "agent",
        }),
      ),
      someoneElse: await attempt(
        db,
        ...insertSql("activity_log", rowFor("activity_log", world.A, world.amy)),
      ),
    }));
    expect(mine.error).toBeUndefined();
    expect(agent.error?.message).toMatch(/row-level security/);
    expect(someoneElse.error?.message).toMatch(/row-level security/);
  });

  it("cannot be edited or deleted by a person", async () => {
    const { edit, del } = await asUser(world.alice, async () => ({
      edit: await attempt(db, "update public.activity_log set summary = 'x'"),
      del: await attempt(db, "delete from public.activity_log"),
    }));
    expect(edit.error?.message).toMatch(/permission denied/);
    expect(del.error?.message).toMatch(/permission denied/);
  });
});

describe("ledger and log times come from the database", () => {
  it.each(["activity_log", "proposals"] as const)(
    "a person cannot back-date or pick the id of %s",
    async (table) => {
      const { dated, withId } = await asUser(world.alice, async () => ({
        dated: await attempt(
          db,
          ...insertSql(table, {
            ...rowFor(table, world.A, world.alice),
            created_at: "2020-01-01T00:00:00Z",
          }),
        ),
        withId: await attempt(
          db,
          ...insertSql(table, { ...rowFor(table, world.A, world.alice), id: randomUUID() }),
        ),
      }));
      expect(dated.error?.message).toMatch(/permission denied/);
      expect(withId.error?.message).toMatch(/permission denied/);
    },
  );
});

describe("document paths", () => {
  it("a document path must start with its own organization's id", async () => {
    const { theirs, mine } = await asUser(world.alice, async () => ({
      theirs: await attempt(
        db,
        ...insertSql("documents", {
          ...rowFor("documents", world.A, world.alice),
          storage_path: `${world.B.id}/x.pdf`,
        }),
      ),
      mine: await attempt(
        db,
        ...insertSql("documents", {
          ...rowFor("documents", world.A, world.alice),
          storage_path: `${world.A.id}/x.pdf`,
        }),
      ),
    }));
    expect(theirs.error?.message).toMatch(/check constraint/);
    expect(mine.error).toBeUndefined();
  });
});

describe("sign-up", () => {
  it("a very long display name is shortened, not a failed sign-up", async () => {
    const id = randomUUID();
    await db.exec("savepoint signup");
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      "long@example.test",
      JSON.stringify({ display_name: "x".repeat(500) }),
    ]);
    const [profile] = await db.query<{ n: number }>(
      "select length(display_name)::int as n from public.profiles where id = $1",
      [id],
    );
    await db.exec("rollback to savepoint signup; release savepoint signup");
    expect(profile.n).toBe(200);
  });
});

describe("records keep their creator", () => {
  it("a person cannot create a record in someone else's name or change its creator", async () => {
    const { spoof, change } = await asUser(world.alice, async () => ({
      spoof: await attempt(
        db,
        ...insertSql("boilerplate", rowFor("boilerplate", world.A, world.amy)),
      ),
      change: await attempt(db, "update public.boilerplate set created_by = $1 where id = $2", [
        world.amy,
        world.A.rows.boilerplate,
      ]),
    }));
    expect(spoof.error?.message).toMatch(/row-level security/);
    expect(change.error?.message).toMatch(/created_by cannot change/);
  });
});

describe("the shared opportunity catalog", () => {
  it("every signed-in person reads it, nobody but server code writes it", async () => {
    const { seen, insert, update, del } = await asUser(world.alice, async () => ({
      seen: await db.query("select id from public.opportunities where id = $1", [
        world.catalogOpportunityId,
      ]),
      insert: await attempt(
        db,
        ...insertSql("opportunities", {
          title: "Fake catalog",
          status: "open",
          source_system: "x",
          external_id: "1",
          created_by: world.alice,
        }),
      ),
      update: await attempt(
        db,
        "update public.opportunities set title = 'changed' where id = $1 returning id",
        [world.catalogOpportunityId],
      ),
      del: await attempt(db, "delete from public.opportunities where id = $1 returning id", [
        world.catalogOpportunityId,
      ]),
    }));
    expect(seen).toHaveLength(1);
    expect(insert.error?.message).toMatch(/row-level security/);
    expect(update.rows).toEqual([]);
    expect(del.rows).toEqual([]);
  });

  it("unknown money stays unknown, never zero", async () => {
    const [row] = await db.query<Record<string, unknown>>(
      "select total_amount_available, min_award_amount, max_award_amount, estimated_award_count from public.opportunities where id = $1",
      [world.catalogOpportunityId],
    );
    expect(Object.values(row)).toEqual([null, null, null, null]);
  });
});

describe("deletion", () => {
  it("deleting an organization removes every record it owns and nothing else", async () => {
    const tables = [
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
    ];
    const countFor = async (orgId: string) => {
      let total = 0;
      for (const t of tables) {
        const [{ n }] = await db.query<{ n: number }>(
          `select count(*)::int as n from public.${t} where organization_id = $1`,
          [orgId],
        );
        total += n;
      }
      return total;
    };
    const bBefore = await countFor(world.B.id);
    await db.exec("savepoint deletion");
    await db.query("delete from public.organizations where id = $1", [world.A.id]);
    expect(await countFor(world.A.id)).toBe(0);
    expect(await countFor(world.B.id)).toBe(bBefore);
    await db.exec("rollback to savepoint deletion; release savepoint deletion");
  });

  it("deleting the account of an organization's last owner is not blocked", async () => {
    await db.exec("savepoint deletion");
    const result = await attempt(db, "delete from auth.users where id = $1", [world.bob]);
    await db.exec("rollback to savepoint deletion; release savepoint deletion");
    expect(result.error).toBeUndefined();
  });
});
