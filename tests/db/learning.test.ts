// Phase AA migration: sessions are numbered by the database and close only with a lesson, facts move
// forward and are never deleted, and accepting a learning proposal writes the record and the decision
// together. Allowed by the testing policy (migrations and row-level security).

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type World, buildWorld, rowFor } from "../rls/fixtures";
import { type Db, as, attempt, insertRow, insertSql, openDb } from "./harness";

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

const PRODUCED_BY = { tool: "test", model: "test-model", date: "2026-11-05" };

/** A proposal linked to the organization's open fixture session, inserted as the editor. */
async function proposeInSession(
  userId: string,
  org: { id: string; sessionId: string; grantId: string },
  payload: Record<string, unknown>,
  grantId: string | null = null,
): Promise<string> {
  const [{ id }] = await db.query<{ id: string }>(
    `insert into public.proposals (organization_id, grant_id, tool_name, summary, payload, model, proposed_by)
     values ($1, $2, 'test', 'A proposal', $3, 'test-model', $4) returning id`,
    [org.id, grantId, { ...payload, source: "ai", produced_by: PRODUCED_BY }, userId],
  );
  await db.query(
    "insert into public.session_proposals (organization_id, session_id, proposal_id) values ($1, $2, $3)",
    [org.id, org.sessionId, id],
  );
  return id;
}

describe("the organization's kind", () => {
  it("defaults to seeker and allows the three kinds only", async () => {
    const [row] = await db.query<{ kind: string }>(
      "select kind from public.organizations where id = $1",
      [world.A.id],
    );
    expect(row.kind).toBe("seeker");
    const bad = await attempt(db, "update public.organizations set kind = 'agency' where id = $1", [
      world.A.id,
    ]);
    expect(bad.error?.message).toMatch(/invalid input value/);
  });

  it("an admin changes it, an editor cannot", async () => {
    const owner = await asUser(world.alice, () =>
      attempt(db, "update public.organizations set kind = 'company' where id = $1 returning kind", [
        world.A.id,
      ]),
    );
    expect(owner.rows).toEqual([{ kind: "company" }]);
    const editor = await asUser(world.ed, () =>
      attempt(db, "update public.organizations set kind = 'funder' where id = $1 returning kind", [
        world.A.id,
      ]),
    );
    expect(editor.rows ?? []).toEqual([]);
  });
});

describe("learning sessions", () => {
  it("are numbered 1, 2, 3 per organization by the database, whatever the caller sends", async () => {
    const numbers = await asUser(world.ed, async () => {
      const [a] = await db.query<{ number: number }>(
        ...insertSqlReturning("learning_sessions", rowFor("learning_sessions", world.A, world.ed)),
      );
      const [b] = await db.query<{ number: number }>(
        ...insertSqlReturning("learning_sessions", rowFor("learning_sessions", world.A, world.ed)),
      );
      return [a.number, b.number];
    });
    // The fixture session is number 1.
    expect(numbers).toEqual([2, 3]);
    const chosen = await asUser(world.ed, () =>
      attempt(
        db,
        ...insertSql("learning_sessions", {
          ...rowFor("learning_sessions", world.A, world.ed),
          number: 40,
        }),
      ),
    );
    expect(chosen.error?.message).toMatch(/permission denied/);
    const [b] = await db.query<{ number: number }>(
      "select max(number)::int as number from public.learning_sessions where organization_id = $1",
      [world.B.id],
    );
    expect(b.number).toBe(1);
  });

  it("cannot close without a lesson, closes once, and then takes no more lessons or proposals", async () => {
    const sessionId = (
      await insertRow(db, "learning_sessions", rowFor("learning_sessions", world.A, world.alice))
    ).id as string;
    const org = { ...world.A, sessionId };
    const results = await asUser(world.ed, async () => {
      const early = await attempt(
        db,
        "update public.learning_sessions set status = 'closed' where id = $1",
        [sessionId],
      );
      await db.query(...insertSql("session_lessons", rowFor("session_lessons", org, world.ed)));
      const [closed] = await db.query<{ status: string; closed_at: string | null }>(
        "update public.learning_sessions set status = 'closed', lessons_summary = 'Done' where id = $1 returning status, closed_at",
        [sessionId],
      );
      const reopen = await attempt(
        db,
        "update public.learning_sessions set status = 'open' where id = $1",
        [sessionId],
      );
      const lateLesson = await attempt(
        db,
        ...insertSql("session_lessons", rowFor("session_lessons", org, world.ed)),
      );
      const lateLink = await attempt(
        db,
        ...insertSql("session_proposals", rowFor("session_proposals", org, world.ed)),
      );
      return { early, closed, reopen, lateLesson, lateLink };
    });
    expect(results.early.error?.message).toMatch(/at least one lesson/);
    expect(results.closed.status).toBe("closed");
    expect(results.closed.closed_at).not.toBeNull();
    expect(results.reopen.error?.message).toMatch(/closed/);
    expect(results.lateLesson.error?.message).toMatch(/closed/);
    expect(results.lateLink.error?.message).toMatch(/closed/);
  });

  it("keep their packet, goal and playbook; nobody deletes a session, a lesson or a link", async () => {
    const results = await asUser(world.alice, async () => ({
      packet: await attempt(
        db,
        "update public.learning_sessions set packet = '{\"x\":1}' where id = $1",
        [world.A.sessionId],
      ),
      goal: await attempt(db, "update public.learning_sessions set goal = 'other' where id = $1", [
        world.A.sessionId,
      ]),
      delSession: await attempt(db, "delete from public.learning_sessions where id = $1", [
        world.A.sessionId,
      ]),
      delLesson: await attempt(db, "delete from public.session_lessons"),
      delLink: await attempt(db, "delete from public.session_proposals"),
      editLesson: await attempt(db, "update public.session_lessons set lesson = 'x'"),
    }));
    for (const r of Object.values(results)) expect(r.error?.message).toMatch(/permission denied/);
  });
});

describe("knowledge facts", () => {
  it("a person cannot back-date or pick the id of a fact", async () => {
    const { dated, withId } = await asUser(world.alice, async () => ({
      dated: await attempt(
        db,
        ...insertSql("knowledge_facts", {
          ...rowFor("knowledge_facts", world.A, world.alice),
          created_at: "2020-01-01T00:00:00Z",
        }),
      ),
      withId: await attempt(
        db,
        ...insertSql("knowledge_facts", {
          ...rowFor("knowledge_facts", world.A, world.alice),
          id: "00000000-0000-0000-0000-000000000001",
        }),
      ),
    }));
    expect(dated.error?.message).toMatch(/permission denied/);
    expect(withId.error?.message).toMatch(/permission denied/);
  });

  it("a confirmed fact is stamped with who confirmed it, and its text never changes", async () => {
    const { fact, edit } = await asUser(world.ed, async () => {
      const [fact] = await db.query<{ id: string; confirmed_by: string; confirmed_at: string }>(
        ...insertSqlReturning("knowledge_facts", rowFor("knowledge_facts", world.A, world.ed)),
      );
      const edit = await attempt(db, "update public.knowledge_facts set fact = 'x' where id = $1", [
        fact.id,
      ]);
      return { fact, edit };
    });
    expect(fact.confirmed_by).toBe(world.ed);
    expect(fact.confirmed_at).not.toBeNull();
    expect(edit.error?.message).toMatch(/permission denied/);
  });

  it("moves forward only: proposed, confirmed, superseded; never deleted", async () => {
    const results = await asUser(world.ed, async () => {
      const [proposed] = await db.query<{ id: string; confirmed_at: string | null }>(
        ...insertSqlReturning("knowledge_facts", {
          ...rowFor("knowledge_facts", world.A, world.ed),
          status: "proposed",
        }),
      );
      const [confirmed] = await db.query<{ confirmed_by: string | null }>(
        "update public.knowledge_facts set status = 'confirmed' where id = $1 returning confirmed_by",
        [proposed.id],
      );
      const back = await attempt(
        db,
        "update public.knowledge_facts set status = 'proposed' where id = $1",
        [proposed.id],
      );
      const noReplacement = await attempt(
        db,
        "update public.knowledge_facts set status = 'superseded' where id = $1",
        [proposed.id],
      );
      const [{ id: newer }] = await db.query<{ id: string }>(
        "select public.supersede_knowledge_fact($1, 'A newer fact', 'person', 'said by the director', 'stated') as id",
        [proposed.id],
      );
      const [old] = await db.query<{ status: string; superseded_by: string }>(
        "select status, superseded_by from public.knowledge_facts where id = $1",
        [proposed.id],
      );
      const twice = await attempt(
        db,
        "select public.supersede_knowledge_fact($1, 'Again', 'person', 'x', 'guess')",
        [proposed.id],
      );
      const del = await attempt(db, "delete from public.knowledge_facts where id = $1", [
        proposed.id,
      ]);
      return { proposed, confirmed, back, noReplacement, newer, old, twice, del };
    });
    expect(results.proposed.confirmed_at).toBeNull();
    expect(results.confirmed.confirmed_by).toBe(world.ed);
    expect(results.back.error?.message).toMatch(/moves only/);
    expect(results.noReplacement.error?.message).toMatch(/names the fact that replaced it/);
    expect(results.old).toEqual({ status: "superseded", superseded_by: results.newer });
    expect(results.twice.error?.message).toMatch(/only a confirmed fact/);
    expect(results.del.error?.message).toMatch(/permission denied/);
  });

  it("cannot be about another organization's funder, contact or grant", async () => {
    for (const [kind, id] of [
      ["funder", world.B.funderId],
      ["contact", world.B.contactId],
      ["grant", world.B.grantId],
    ] as const) {
      const result = await attempt(
        db,
        ...insertSql("knowledge_facts", {
          ...rowFor("knowledge_facts", world.A, world.alice),
          subject_kind: kind,
          subject_id: id,
        }),
      );
      expect(result.error?.message, kind).toMatch(/same organization/);
    }
    const catalog = await attempt(
      db,
      ...insertSql("knowledge_facts", {
        ...rowFor("knowledge_facts", world.A, world.alice),
        subject_kind: "opportunity",
        subject_id: world.catalogOpportunityId,
      }),
    );
    expect(catalog.error).toBeUndefined();
  });
});

describe("touches", () => {
  it("are logged in the person's own name and never edited or deleted", async () => {
    const { mine, someoneElse, edit, del } = await asUser(world.ed, async () => ({
      mine: await attempt(db, ...insertSql("touches", rowFor("touches", world.A, world.ed))),
      someoneElse: await attempt(
        db,
        ...insertSql("touches", rowFor("touches", world.A, world.alice)),
      ),
      edit: await attempt(db, "update public.touches set summary = 'x'"),
      del: await attempt(db, "delete from public.touches"),
    }));
    expect(mine.error).toBeUndefined();
    expect(someoneElse.error?.message).toMatch(/row-level security/);
    expect(edit.error?.message).toMatch(/permission denied/);
    expect(del.error?.message).toMatch(/permission denied/);
  });

  it("cannot point at another organization's contact or session", async () => {
    const contact = await attempt(
      db,
      ...insertSql("touches", {
        ...rowFor("touches", world.A, world.alice),
        contact_id: world.B.contactId,
      }),
    );
    const session = await attempt(
      db,
      ...insertSql("touches", {
        ...rowFor("touches", world.A, world.alice),
        session_id: world.B.sessionId,
      }),
    );
    expect(contact.error?.message).toMatch(/foreign key/);
    expect(session.error?.message).toMatch(/foreign key/);
  });
});

describe("accepting a learning proposal", () => {
  it("writes a confirmed fact, creates the funder it names, and marks the proposal accepted", async () => {
    const result = await asUser(world.ed, async () => {
      const proposalId = await proposeInSession(world.ed, world.A, {
        kind: "knowledge_fact",
        subject_kind: "funder",
        fact: "Gave 12 grants in 2024.",
      });
      const [{ id }] = await db.query<{ id: string }>(
        "select public.accept_learning_proposal($1, $2) as id",
        [
          proposalId,
          {
            kind: "knowledge_fact",
            subject_kind: "funder",
            funder_ref: { ein: "12-3456789", name: "Example Community Foundation" },
            fact: "Gave 12 grants in 2024.",
            source_kind: "filing",
            source_ref: "990-PF 2024",
            confidence: "stated",
          },
        ],
      );
      const [fact] = await db.query<{
        status: string;
        subject_id: string;
        confirmed_by: string;
        fact: string;
      }>(
        "select status, subject_id, confirmed_by, fact from public.knowledge_facts where id = $1",
        [id],
      );
      const [funder] = await db.query<{ name: string; ein: string; organization_id: string }>(
        "select name, ein, organization_id from public.funders where id = $1",
        [fact.subject_id],
      );
      const [proposal] = await db.query<{ status: string; decided_by: string }>(
        "select status, decided_by from public.proposals where id = $1",
        [proposalId],
      );
      const again = await attempt(db, "select public.accept_learning_proposal($1, $2)", [
        proposalId,
        {
          kind: "knowledge_fact",
          subject_kind: "funder",
          fact: "x",
          source_kind: "ai",
          source_ref: "x",
        },
      ]);
      return { fact, funder, proposal, again };
    });
    expect(result.fact.status).toBe("confirmed");
    expect(result.fact.confirmed_by).toBe(world.ed);
    expect(result.funder).toEqual({
      name: "Example Community Foundation",
      ein: "123456789",
      organization_id: world.A.id,
    });
    expect(result.proposal).toEqual({ status: "accepted", decided_by: world.ed });
    expect(result.again.error?.message).toMatch(/already decided/);
  });

  it("reuses a funder the organization already has, matched by EIN", async () => {
    await db.query("update public.funders set ein = '98-7654321' where id = $1", [
      world.A.funderId,
    ]);
    const subject = await asUser(world.ed, async () => {
      const proposalId = await proposeInSession(world.ed, world.A, {
        kind: "contact",
        name: "Pat Example",
      });
      const [{ id }] = await db.query<{ id: string }>(
        "select public.accept_learning_proposal($1, $2) as id",
        [
          proposalId,
          {
            kind: "contact",
            name: "Pat Example",
            role: "Program officer",
            funder_ref: { ein: "987654321", name: "A different spelling" },
            publishability: "public",
          },
        ],
      );
      const [contact] = await db.query<{ funder_id: string; publishability: string }>(
        "select funder_id, publishability from public.contacts where id = $1",
        [id],
      );
      return contact;
    });
    expect(subject).toEqual({ funder_id: world.A.funderId, publishability: "public" });
  });

  it("writes a task for a task or an outreach draft, on the proposal's grant", async () => {
    const task = await asUser(world.ed, async () => {
      const proposalId = await proposeInSession(
        world.ed,
        world.A,
        { kind: "outreach_draft", to_contact_name: "Pat Example" },
        world.A.grantId,
      );
      const [{ id }] = await db.query<{ id: string }>(
        "select public.accept_learning_proposal($1, $2) as id",
        [
          proposalId,
          {
            kind: "outreach_draft",
            title: "Send email to Pat Example",
            description: "Draft prepared with AI (test-model, 2026-11-05). Check before sending.",
            due_date: null,
          },
        ],
      );
      const [task] = await db.query<{ grant_id: string; title: string; status: string }>(
        "select grant_id, title, status from public.tasks where id = $1",
        [id],
      );
      return task;
    });
    expect(task).toEqual({
      grant_id: world.A.grantId,
      title: "Send email to Pat Example",
      status: "open",
    });
  });

  it("writes a lesson on the proposal's session", async () => {
    const lesson = await asUser(world.ed, async () => {
      const proposalId = await proposeInSession(world.ed, world.A, {
        kind: "lesson",
        lesson: "Small funders answer faster.",
      });
      const [{ id }] = await db.query<{ id: string }>(
        "select public.accept_learning_proposal($1, $2) as id",
        [
          proposalId,
          {
            kind: "lesson",
            applies_to: "outreach",
            lesson: "Small funders answer faster.",
            evidence: "Two replies within a week.",
          },
        ],
      );
      const [lesson] = await db.query<{ session_id: string; applies_to: string }>(
        "select session_id, applies_to from public.session_lessons where id = $1",
        [id],
      );
      return lesson;
    });
    expect(lesson).toEqual({ session_id: world.A.sessionId, applies_to: "outreach" });
  });

  it("never accepts a stage move here, never a record of another kind, and never for a viewer", async () => {
    const { stageMove, mismatch } = await asUser(world.ed, async () => {
      const move = await proposeInSession(
        world.ed,
        world.A,
        { kind: "stage_move", to_stage: "qualifying", why: "x" },
        world.A.grantId,
      );
      const stageMove = await attempt(db, "select public.accept_learning_proposal($1, $2)", [
        move,
        { kind: "stage_move" },
      ]);
      const fact = await proposeInSession(world.ed, world.A, { kind: "knowledge_fact" });
      const mismatch = await attempt(db, "select public.accept_learning_proposal($1, $2)", [
        fact,
        { kind: "task", title: "Sneaky" },
      ]);
      return { stageMove, mismatch };
    });
    expect(stageMove.error?.message).toMatch(/grant record page/);
    expect(mismatch.error?.message).toMatch(/does not match/);

    const [stage] = await db.query<{ stage: string }>(
      "select stage from public.grants where id = $1",
      [world.A.grantId],
    );
    expect(stage.stage).toBe("prospect");

    const proposalId = await proposeInSession(world.alice, world.A, { kind: "task", title: "T" });
    const viewer = await asUser(world.amy, () =>
      attempt(db, "select public.accept_learning_proposal($1, $2)", [
        proposalId,
        { kind: "task", title: "T" },
      ]),
    );
    expect(viewer.error?.message).toMatch(
      /proposal not found|permission denied|row-level security/,
    );
    const [untouched] = await db.query<{ status: string }>(
      "select status from public.proposals where id = $1",
      [proposalId],
    );
    expect(untouched.status).toBe("proposed");
  });

  it("a proposal from another organization's session cannot be accepted", async () => {
    const proposalId = await proposeInSession(world.bob, world.B, { kind: "task", title: "T" });
    const result = await asUser(world.alice, () =>
      attempt(db, "select public.accept_learning_proposal($1, $2)", [
        proposalId,
        { kind: "task", title: "T" },
      ]),
    );
    expect(result.error?.message).toMatch(/proposal not found/);
  });
});

function insertSqlReturning(table: string, values: Record<string, unknown>): [string, unknown[]] {
  const columns = Object.keys(values);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  return [
    `insert into public.${table} (${columns.join(", ")}) values (${placeholders.join(", ")}) returning *`,
    Object.values(values),
  ];
}
