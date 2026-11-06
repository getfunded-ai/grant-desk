// Phase E's tables: feed items, calendar tokens, reminder preferences, the reminder log and
// contacts. The data wall for them is in tenant-isolation.test.ts; this file checks their own rules.

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Db, as, attempt, insertSql, openDb } from "../db/harness";
import { type World, buildWorld, rowFor } from "./fixtures";

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

describe("feed items", () => {
  it("cannot point at another organization's feed", async () => {
    const result = await asUser(world.alice, () =>
      attempt(
        db,
        ...insertSql("feed_items", {
          ...rowFor("feed_items", world.A, world.alice),
          external_feed_id: world.B.feedId,
        }),
      ),
    );
    expect(result.error?.message).toMatch(/foreign key|row-level security/);
  });

  it("are unique per feed and item id, so a refresh updates instead of duplicating", async () => {
    const values = rowFor("feed_items", world.A, world.alice);
    const result = await asUser(world.alice, async () => {
      const first = await attempt(db, ...insertSql("feed_items", values));
      const second = await attempt(db, ...insertSql("feed_items", values));
      return { first, second };
    });
    expect(result.first.error).toBeUndefined();
    expect(result.second.error?.message).toMatch(/unique|duplicate/);
  });

  it("go away with their feed", async () => {
    const feed = await db.query<{ id: string }>(
      "insert into public.external_feeds (organization_id, name, kind, url, created_by) values ($1, 'Temp', 'rss', 'https://example.org/temp.xml', $2) returning id",
      [world.A.id, world.alice],
    );
    await db.query(
      ...insertSql("feed_items", {
        ...rowFor("feed_items", world.A, world.alice),
        external_feed_id: feed[0].id,
      }),
    );
    await db.query("delete from public.external_feeds where id = $1", [feed[0].id]);
    const left = await db.query("select id from public.feed_items where external_feed_id = $1", [
      feed[0].id,
    ]);
    expect(left).toEqual([]);
  });
});

describe("calendar tokens", () => {
  it("store only a sha256 hash, never a token", async () => {
    const result = await asUser(world.alice, () =>
      attempt(
        db,
        ...insertSql("calendar_tokens", {
          ...rowFor("calendar_tokens", world.A, world.alice),
          token_hash: "not-a-hash",
        }),
      ),
    );
    expect(result.error?.message).toMatch(/check constraint/);
  });

  it("are unique across organizations, so an address names exactly one organization", async () => {
    const hash = rowFor("calendar_tokens", world.A, world.alice).token_hash;
    await db.query(
      ...insertSql("calendar_tokens", {
        ...rowFor("calendar_tokens", world.A, world.alice),
        token_hash: hash,
      }),
    );
    const clash = await attempt(
      db,
      ...insertSql("calendar_tokens", {
        ...rowFor("calendar_tokens", world.B, world.bob),
        token_hash: hash,
      }),
    );
    expect(clash.error?.message).toMatch(/unique|duplicate/);
  });

  it("an editor can revoke one", async () => {
    const [row] = await db.query<{ id: string }>(
      ...insertSql("calendar_tokens", rowFor("calendar_tokens", world.A, world.alice)),
    );
    const updated = await asUser(world.ed, () =>
      attempt(
        db,
        "update public.calendar_tokens set revoked_at = now() where id = $1 returning id",
        [row.id],
      ),
    );
    expect(updated.rows).toHaveLength(1);
  });
});

describe("reminder preferences", () => {
  it("a person sees and sets only their own, inside their organization", async () => {
    const mine = await asUser(world.amy, () =>
      attempt(
        db,
        ...insertSql("reminder_preferences", rowFor("reminder_preferences", world.A, world.amy)),
      ),
    );
    expect(mine.error).toBeUndefined();

    const someoneElse = await asUser(world.amy, () =>
      attempt(
        db,
        ...insertSql("reminder_preferences", {
          ...rowFor("reminder_preferences", world.A, world.amy),
          user_id: world.ed,
        }),
      ),
    );
    expect(someoneElse.error?.message).toMatch(/row-level security/);

    // The owner's row from the fixtures is invisible to another member.
    const visible = await asUser(world.amy, () =>
      db.query<{ user_id: string }>("select user_id from public.reminder_preferences"),
    );
    expect(visible.every((r) => r.user_id === world.amy)).toBe(true);
  });

  it("belongs to a membership and is removed when the person leaves", async () => {
    const stranger = await attempt(
      db,
      ...insertSql("reminder_preferences", {
        ...rowFor("reminder_preferences", world.A, world.nina),
      }),
    );
    expect(stranger.error?.message).toMatch(/foreign key/);

    await db.query(
      ...insertSql("reminder_preferences", rowFor("reminder_preferences", world.A, world.ed)),
    );
    await db.query("delete from public.memberships where organization_id = $1 and user_id = $2", [
      world.A.id,
      world.ed,
    ]);
    const left = await db.query(
      "select id from public.reminder_preferences where organization_id = $1 and user_id = $2",
      [world.A.id, world.ed],
    );
    expect(left).toEqual([]);
  });
});

describe("the reminder log", () => {
  it("is written only by server code, never by a person", async () => {
    const result = await asUser(world.alice, () =>
      attempt(db, ...insertSql("reminder_log", rowFor("reminder_log", world.A, world.alice))),
    );
    expect(result.error?.message).toMatch(/permission denied/);
  });

  it("records each reminder step once per person and item", async () => {
    const values = rowFor("reminder_log", world.A, world.alice);
    await db.query(...insertSql("reminder_log", values));
    const again = await attempt(db, ...insertSql("reminder_log", values));
    expect(again.error?.message).toMatch(/unique|duplicate/);
    const otherStep = await attempt(
      db,
      ...insertSql("reminder_log", { ...values, days_before: 1 }),
    );
    expect(otherStep.error).toBeUndefined();
  });

  it("a person reads only the reminders sent to them", async () => {
    await db.query(...insertSql("reminder_log", rowFor("reminder_log", world.A, world.ed)));
    const rows = await asUser(world.amy, () =>
      db.query<{ user_id: string }>("select user_id from public.reminder_log"),
    );
    expect(rows.every((r) => r.user_id === world.amy)).toBe(true);
  });
});

describe("contacts", () => {
  it("must belong to a grant or a funder", async () => {
    const result = await asUser(world.alice, () =>
      attempt(
        db,
        ...insertSql("contacts", {
          organization_id: world.A.id,
          name: "Nobody's contact",
          created_by: world.alice,
        }),
      ),
    );
    expect(result.error?.message).toMatch(/check constraint/);
  });

  it("cannot point at another organization's grant or funder", async () => {
    const result = await asUser(world.alice, () =>
      attempt(
        db,
        ...insertSql("contacts", {
          ...rowFor("contacts", world.A, world.alice),
          grant_id: world.B.grantId,
        }),
      ),
    );
    expect(result.error?.message).toMatch(/foreign key/);
    const funder = await asUser(world.alice, () =>
      attempt(
        db,
        ...insertSql("contacts", {
          organization_id: world.A.id,
          funder_id: world.B.funderId,
          name: `Contact ${randomUUID().slice(0, 8)}`,
          created_by: world.alice,
        }),
      ),
    );
    expect(funder.error?.message).toMatch(/foreign key/);
  });
});
