// Phase AA "Done when": a member of organization A cannot read B's sessions, facts, contacts or
// touches (nor lessons and session links), and a viewer cannot open a session or log a touch.
// tests/rls/tenant-isolation.test.ts covers every write across the wall for these tables too.

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

const LEARNING_TABLES = [
  "learning_sessions",
  "knowledge_facts",
  "contacts",
  "touches",
  "session_lessons",
  "session_proposals",
] as const;

describe("a member of organization A", () => {
  it.each(LEARNING_TABLES)("sees only A's rows of %s, never B's", async (table) => {
    for (const me of [world.alice, world.amy, world.ed]) {
      const rows = await as(db, { role: "authenticated", userId: me }, () =>
        db.query<{ id: string; organization_id: string }>(
          `select id, organization_id from public.${table}`,
        ),
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.organization_id === world.A.id)).toBe(true);
      expect(rows.map((r) => r.id)).not.toContain(world.B.rows[table]);
    }
  });

  it("cannot read B's packet by id, nor its lessons through the session", async () => {
    const { packet, lessons } = await as(
      db,
      { role: "authenticated", userId: world.alice },
      async () => ({
        packet: await db.query("select packet from public.learning_sessions where id = $1", [
          world.B.sessionId,
        ]),
        lessons: await db.query("select lesson from public.session_lessons where session_id = $1", [
          world.B.sessionId,
        ]),
      }),
    );
    expect(packet).toEqual([]);
    expect(lessons).toEqual([]);
  });

  it("cannot link a proposal of A to a session of B, or a proposal of B to a session of A", async () => {
    const { toTheirSession, theirProposal } = await as(
      db,
      { role: "authenticated", userId: world.alice },
      async () => ({
        toTheirSession: await attempt(
          db,
          ...insertSql("session_proposals", {
            organization_id: world.B.id,
            session_id: world.B.sessionId,
            proposal_id: world.A.proposalId,
          }),
        ),
        theirProposal: await attempt(
          db,
          ...insertSql("session_proposals", {
            organization_id: world.A.id,
            session_id: world.A.sessionId,
            proposal_id: world.B.proposalId,
          }),
        ),
      }),
    );
    expect(toTheirSession.error?.message).toMatch(/row-level security/);
    expect(theirProposal.error?.message).toMatch(/foreign key/);
  });
});

describe("a viewer", () => {
  it("reads sessions, facts and contacts but cannot open a session, add a fact or log a touch", async () => {
    const results = await as(db, { role: "authenticated", userId: world.amy }, async () => ({
      read: await db.query("select id from public.learning_sessions"),
      session: await attempt(
        db,
        ...insertSql("learning_sessions", rowFor("learning_sessions", world.A, world.amy)),
      ),
      fact: await attempt(
        db,
        ...insertSql("knowledge_facts", rowFor("knowledge_facts", world.A, world.amy)),
      ),
      touch: await attempt(db, ...insertSql("touches", rowFor("touches", world.A, world.amy))),
      close: await attempt(
        db,
        "update public.learning_sessions set status = 'closed' where id = $1 returning id",
        [world.A.sessionId],
      ),
    }));
    expect(results.read).toHaveLength(1);
    expect(results.session.error?.message).toMatch(/row-level security/);
    expect(results.fact.error?.message).toMatch(/row-level security/);
    expect(results.touch.error?.message).toMatch(/row-level security/);
    expect(results.close.rows ?? []).toEqual([]);
  });
});

describe("an editor", () => {
  it("opens a session in their own name only", async () => {
    const { own, spoof } = await as(db, { role: "authenticated", userId: world.ed }, async () => ({
      own: await attempt(
        db,
        ...insertSql("learning_sessions", rowFor("learning_sessions", world.A, world.ed)),
      ),
      spoof: await attempt(
        db,
        ...insertSql("learning_sessions", rowFor("learning_sessions", world.A, world.alice)),
      ),
    }));
    expect(own.error).toBeUndefined();
    expect(spoof.error?.message).toMatch(/row-level security/);
  });
});
