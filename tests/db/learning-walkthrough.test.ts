// The Phase AA "Done when" walk-through, run against the real migrations in PGlite as the editor of
// one organization: start session 1 with seeker-prospecting, render the packet, import a results
// file with three hand-written items, accept two, reject one, close with a lesson, start session 2
// and find session 1's lesson in its packet. The packet builder and the results validator are the
// pure modules the pages use; only the Next.js pages and server actions are outside this test.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type PacketInput, buildPacket, renderPacketMarkdown } from "../../lib/learning/packet";
import { parseResults, recordForPayload } from "../../lib/learning/results";
import type { Packet, ProposalPayload } from "../../lib/learning/types";
import { type World, buildWorld } from "../rls/fixtures";
import { type Db, as, attempt, openDb } from "./harness";

let db: Db;
let world: World;

beforeAll(async () => {
  db = await openDb();
  world = await buildWorld(db);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const asEditor = <T>(fn: () => Promise<T>) =>
  as(db, { role: "authenticated", userId: world.ed }, fn);

/** What lib/learning/queries.ts reads for the packet, as plain SQL under the editor's session. */
async function packetInput(organizationId: string): Promise<PacketInput> {
  const [organization] = await db.query<PacketInput["organization"]>(
    "select id, name, kind, ein, uei, mission from public.organizations where id = $1",
    [organizationId],
  );
  const facts = await db.query<PacketInput["facts"][number]>(
    "select id, subject_kind, subject_id, fact, source_kind, source_ref, confidence, confirmed_at::text from public.knowledge_facts where organization_id = $1 and status = 'confirmed'",
    [organizationId],
  );
  const grants = await db.query<PacketInput["grants"][number]>(
    "select g.id, g.title, g.stage, g.funder_id, f.name as funder_name, g.amount_requested, g.amount_awarded, g.submission_due_at::text from public.grants g left join public.funders f on f.id = g.funder_id where g.organization_id = $1",
    [organizationId],
  );
  const deadlines = await db.query<PacketInput["deadlines"][number]>(
    "select grant_id, title, due_at::text, kind::text from public.deadlines where organization_id = $1",
    [organizationId],
  );
  const contacts = await db.query<PacketInput["contacts"][number]>(
    "select id, name, role, funder_id from public.contacts where organization_id = $1",
    [organizationId],
  );
  const touches = await db.query<PacketInput["touches"][number]>(
    "select contact_id, kind::text, happened_at::text from public.touches where organization_id = $1",
    [organizationId],
  );
  const lessons = await db.query<PacketInput["lessons"][number]>(
    "select s.number as session_number, l.applies_to, l.lesson, l.evidence from public.session_lessons l join public.learning_sessions s on s.id = l.session_id where l.organization_id = $1",
    [organizationId],
  );
  return {
    organization,
    facts,
    grants,
    deadlines,
    contacts,
    touches,
    lessons: lessons.map((l) => ({ ...l, session_number: Number(l.session_number) })),
    now: new Date("2026-11-06T00:00:00Z"),
  };
}

async function startSession(goal: string): Promise<{ id: string; number: number; packet: Packet }> {
  const [row] = await db.query<{ id: string; number: number; packet: Packet }>(
    "insert into public.learning_sessions (organization_id, playbook_key, goal, packet) values ($1, 'seeker-prospecting', $2, $3) returning id, number, packet",
    [world.A.id, goal, buildPacket(await packetInput(world.A.id))],
  );
  return row;
}

const PLAYBOOK = { title: "Prospecting for a grant seeker", body: "Read, look up, record, cite." };

describe("the Done-when walk-through", () => {
  it("runs from session 1 to session 2 and carries the lesson over", async () => {
    // The fixture organization already holds one open session (number 1); close it so the
    // walk-through starts clean, as a person would.
    await db.query(
      "insert into public.session_lessons (organization_id, session_id, lesson) values ($1, $2, 'Fixture lesson.')",
      [world.A.id, world.A.sessionId],
    );
    await db.query("update public.learning_sessions set status = 'closed' where id = $1", [
      world.A.sessionId,
    ]);

    const result = await asEditor(async () => {
      // 1. Start session 1 with seeker-prospecting. The database numbers it and stamps the session
      //    block into the frozen packet.
      const session1 = await startSession("Find three foundations that fund youth programs here.");
      expect(session1.number).toBe(2); // the fixture session was number 1
      expect(session1.packet.session?.id).toBe(session1.id);
      expect(session1.packet.session?.playbook).toBe("seeker-prospecting");
      expect(session1.packet.lessons.map((l) => l.lesson)).toContain("Fixture lesson.");

      // 2. Download the packet: the Markdown a person pastes into an assistant.
      const markdown = renderPacketMarkdown(session1.packet, PLAYBOOK);
      expect(markdown).toContain(`Session id: ${session1.id}`);
      expect(markdown).toContain("```json");
      expect(markdown).not.toContain("US$0");
      const dataBlock = /```json\n([\s\S]*?)\n```/.exec(markdown)![1];
      expect((JSON.parse(dataBlock) as Packet).session?.id).toBe(session1.id);

      // 3. Import a results file with three items written by hand, following the format.
      const results = {
        schema_version: 1,
        session_id: session1.id,
        produced_by: {
          tool: "hand-written for the walk-through",
          model: "none",
          date: "2026-11-06",
        },
        summary: "Prepared by hand for the walk-through. A person must check every item.",
        items: [
          {
            kind: "knowledge_fact",
            payload: {
              subject_kind: "funder",
              subject_ref: { ein: "11-1111111", name: "Example Youth Foundation" },
              fact: "Made 14 grants in 2024, between US$5,000 and US$25,000, to youth programs in the county.",
              source_kind: "filing",
              source_ref: "Form 990-PF, 2024, Part XV",
              confidence: "stated",
            },
            evidence: [
              { source_ref: "Form 990-PF, 2024, Part XV", quote: "14 grants paid during the year" },
            ],
          },
          {
            kind: "contact",
            payload: {
              name: "Sam Example",
              role: "Program officer",
              funder_ref: { ein: "11-1111111", name: "Example Youth Foundation" },
              publishability: "public",
              source_ref: "https://example.org/staff",
            },
            evidence: [
              { source_ref: "https://example.org/staff", quote: "Sam Example, Program Officer" },
            ],
          },
          {
            kind: "task",
            payload: {
              title: "Read the foundation's 2026 guidelines before the call",
              grant_ref: { id: null, title: null },
              due_at: "2026-11-20",
              why: "The filing lists a November letter-of-inquiry window.",
            },
            evidence: [],
          },
        ],
      };
      const parsed = parseResults(JSON.stringify(results), {
        sessionId: session1.id,
        grantIds: new Set([world.A.grantId]),
      });
      if (!parsed.ok) throw new Error(parsed.errors.join(" "));
      expect(parsed.rejected).toEqual([]);
      expect(parsed.prepared).toHaveLength(3);
      const ids = (
        await db.query<{ id: string }>("select public.record_learning_proposals($1, $2) as id", [
          session1.id,
          parsed.prepared.map((p) => ({
            tool_name: parsed.file.produced_by.tool,
            summary: p.summary,
            payload: p.payload,
            model: parsed.file.produced_by.model,
            sources: p.sources,
            grant_id: p.grantId,
          })),
        ])
      ).map((r) => r.id);
      expect(ids).toHaveLength(3);
      const stored = await db.query<{
        id: string;
        status: string;
        model: string;
        payload: ProposalPayload;
      }>(
        "select p.id, p.status, p.model, p.payload from public.proposals p join public.session_proposals sp on sp.proposal_id = p.id where sp.session_id = $1 order by (p.payload ->> 'item_index')::int",
        [session1.id],
      );
      expect(stored.map((s) => [s.status, s.model, s.payload.source])).toEqual([
        ["proposed", "none", "ai"],
        ["proposed", "none", "ai"],
        ["proposed", "none", "ai"],
      ]);

      // 4. Accept two (the fact and the contact), reject one (the task).
      const [fact, contact, task] = stored;
      await db.query("select public.accept_learning_proposal($1, $2)", [
        fact.id,
        recordForPayload(fact.payload),
      ]);
      await db.query("select public.accept_learning_proposal($1, $2)", [
        contact.id,
        recordForPayload(contact.payload),
      ]);
      await db.query("update public.proposals set status = 'rejected' where id = $1", [task.id]);
      const decisions = await db.query<{ status: string }>(
        "select status from public.proposals where id = any($1) order by (payload ->> 'item_index')::int",
        [[fact.id, contact.id, task.id]],
      );
      expect(decisions.map((d) => d.status)).toEqual(["accepted", "accepted", "rejected"]);
      const [funder] = await db.query<{ id: string; name: string; ein: string }>(
        "select id, name, ein from public.funders where organization_id = $1 and ein = '111111111'",
        [world.A.id],
      );
      expect(funder.name).toBe("Example Youth Foundation");
      const facts = await db.query<{ status: string; subject_id: string; source_ref: string }>(
        "select status, subject_id, source_ref from public.knowledge_facts where organization_id = $1 and source_ref like 'Form 990-PF%'",
        [world.A.id],
      );
      expect(facts).toEqual([
        { status: "confirmed", subject_id: funder.id, source_ref: "Form 990-PF, 2024, Part XV" },
      ]);
      const contacts = await db.query<{ funder_id: string; publishability: string; notes: string }>(
        "select funder_id, publishability, notes from public.contacts where organization_id = $1 and name = 'Sam Example'",
        [world.A.id],
      );
      expect(contacts[0].funder_id).toBe(funder.id);
      expect(contacts[0].publishability).toBe("public");
      expect(contacts[0].notes).toContain("Proposed with AI (none, 2026-11-06)");
      const tasks = await db.query(
        "select id from public.tasks where organization_id = $1 and title like 'Read the foundation%'",
        [world.A.id],
      );
      expect(tasks).toEqual([]); // rejected: nothing written

      // 5. Close with one lesson.
      await db.query(
        "insert into public.session_lessons (organization_id, session_id, applies_to, lesson, evidence) values ($1, $2, 'prospecting', 'Start with foundations whose 990-PF lists grants under US$25,000; they matched our size.', 'One of three candidates gave at our size.')",
        [world.A.id, session1.id],
      );
      const [closed] = await db.query<{ status: string; closed_at: string | null }>(
        "update public.learning_sessions set status = 'closed', lessons_summary = 'Found one matching foundation and one contact.' where id = $1 returning status, closed_at",
        [session1.id],
      );
      expect(closed.status).toBe("closed");
      expect(closed.closed_at).not.toBeNull();

      // 6. Start session 2: its packet holds session 1's lesson and the new confirmed fact.
      const session2 = await startSession("Reach the program officer found in session 1.");
      expect(session2.number).toBe(3);
      return { session2, session1Number: session1.number };
    });

    const lessons = result.session2.packet.lessons;
    expect(lessons[0]).toMatchObject({
      session_number: result.session1Number,
      applies_to: "prospecting",
      lesson:
        "Start with foundations whose 990-PF lists grants under US$25,000; they matched our size.",
      evidence: "One of three candidates gave at our size.",
    });
    expect(lessons.map((l) => l.lesson)).toContain("Fixture lesson.");
    expect(
      result.session2.packet.knowledge.some((f) => f.source_ref.startsWith("Form 990-PF")),
    ).toBe(true);
    // The new contact has no touch yet and its funder has no open grant, so it stays out of the
    // packet; private details never appear anywhere in it.
    expect(JSON.stringify(result.session2.packet)).not.toContain("@");
  });

  it("rejects the files and items the format says to reject", async () => {
    // A fresh open session, since the walk-through above closed the fixture one.
    const [{ id: sessionId }] = await db.query<{ id: string }>(
      "insert into public.learning_sessions (organization_id, playbook_key, goal, packet) values ($1, 'seeker-prospecting', 'Check the rules.', '{}') returning id",
      [world.A.id],
    );
    const ctx = { sessionId, grantIds: new Set([world.A.grantId]) };
    const base = {
      schema_version: 1,
      session_id: sessionId,
      produced_by: { tool: "t", model: "m", date: "2026-11-06" },
      summary: "s",
    };
    const fact = (over: Record<string, unknown>) => ({
      kind: "knowledge_fact",
      payload: {
        subject_kind: "funder",
        fact: "Gave 10 grants.",
        source_kind: "filing",
        source_ref: "990",
        confidence: "stated",
        ...over,
      },
      evidence: [{ source_ref: "990", quote: "10 grants" }],
    });

    const wrongSession = parseResults(
      JSON.stringify({ ...base, session_id: world.B.sessionId, items: [fact({})] }),
      ctx,
    );
    expect(wrongSession.ok).toBe(false);
    const noModel = parseResults(
      JSON.stringify({
        ...base,
        produced_by: { tool: "t", date: "2026-11-06" },
        items: [fact({})],
      }),
      ctx,
    );
    expect(noModel.ok).toBe(false);
    const wrongVersion = parseResults(
      JSON.stringify({ ...base, schema_version: 2, items: [fact({})] }),
      ctx,
    );
    expect(wrongVersion.ok).toBe(false);
    const tooMany = parseResults(
      JSON.stringify({ ...base, items: Array.from({ length: 26 }, () => fact({})) }),
      ctx,
    );
    expect(tooMany.ok).toBe(false);

    const items = parseResults(
      JSON.stringify({
        ...base,
        items: [
          fact({}),
          { ...fact({}), evidence: [] },
          fact({ fact: "The funder IS INTERESTED in our work." }),
          fact({ fact: "We are eligible." }), // "are eligible" is not the forbidden phrase; it passes
          fact({ fact: "Our organization is eligible for this program." }),
          fact({ fact: "They will fund us next year." }),
          {
            kind: "stage_move",
            payload: {
              grant_ref: { id: world.B.grantId, title: "Theirs" },
              to_stage: "qualifying",
              why: "x",
            },
            evidence: [{ source_ref: "notes", quote: "" }],
          },
          {
            kind: "stage_move",
            payload: {
              grant_ref: { id: world.A.grantId, title: "Ours" },
              from_stage: "prospect",
              to_stage: "qualifying",
              why: "The guidelines match.",
            },
            evidence: [{ source_ref: "guidelines", quote: "Applicants in the county" }],
          },
          { kind: "contact", payload: { name: "Pat" }, evidence: [] },
          {
            kind: "lesson",
            payload: { applies_to: "general", lesson: "Keep it short.", evidence: "Replies." },
            evidence: [],
          },
        ],
      }),
      ctx,
    );
    if (!items.ok) throw new Error(items.errors.join(" "));
    expect(items.prepared.map((p) => p.index)).toEqual([0, 3, 7, 9]);
    expect(items.rejected.map((r) => [r.index, r.reason])).toEqual([
      [1, "evidence is empty"],
      [2, 'the payload says "is interested"; say what the record shows instead'],
      [4, 'the payload says "is eligible"; say what the record shows instead'],
      [5, 'the payload says "will fund"; say what the record shows instead'],
      [6, "names a grant this organization does not have"],
      [8, "evidence is empty"],
    ]);
    const move = items.prepared.find((p) => p.kind === "stage_move")!;
    expect(move.grantId).toBe(world.A.grantId);
    expect(move.payload).toMatchObject({
      kind: "stage_move",
      to_stage: "qualifying",
      why: "The guidelines match.",
    });
    const lesson = items.prepared.find((p) => p.kind === "lesson")!;
    expect(lesson.payload.evidence_text).toBe("Replies.");
    expect(lesson.payload.evidence).toEqual([]);

    // A stage move is stored as a proposal on the grant but is never accepted here.
    const stored = await asEditor(async () => {
      const [{ id }] = await db.query<{ id: string }>(
        "select public.record_learning_proposals($1, $2) as id",
        [
          sessionId,
          [
            {
              tool_name: "t",
              summary: move.summary,
              payload: move.payload,
              model: "m",
              sources: move.sources,
              grant_id: move.grantId,
            },
          ],
        ],
      );
      const blocked = await attempt(db, "select public.accept_learning_proposal($1, $2)", [
        id,
        { kind: "stage_move" },
      ]);
      const [row] = await db.query<{ grant_id: string; status: string; payload: ProposalPayload }>(
        "select grant_id, status, payload from public.proposals where id = $1",
        [id],
      );
      return { blocked, row };
    });
    expect(stored.blocked.error?.message).toMatch(/grant record page/);
    expect(stored.row.grant_id).toBe(world.A.grantId);
    expect(stored.row.status).toBe("proposed");
    expect(stored.row.payload.evidence).toEqual([
      { source_ref: "guidelines", quote: "Applicants in the county" },
    ]);
  });
});
