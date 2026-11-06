// Phase G rules: an award belongs to one grant in its own organization; every report due keeps one
// calendar entry (deadlines) in step through the sync trigger; budget actuals stay on a line of the
// same award; viewers read but never write; only admins delete an award.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Db, as, attempt, insertRow, insertSql, openDb } from "../db/harness";
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

type DeadlineRow = {
  id: string;
  grant_id: string | null;
  title: string;
  kind: string;
  due_at: string | Date;
  all_day: boolean;
  organization_id: string;
};

async function deadlineFor(reportId: string): Promise<DeadlineRow | undefined> {
  const [row] = await db.query<DeadlineRow>(
    `select d.id, d.grant_id, d.title, d.kind, d.due_at, d.all_day, d.organization_id
     from public.award_reports r join public.deadlines d on d.id = r.deadline_id
     where r.id = $1`,
    [reportId],
  );
  return row;
}

describe("awards", () => {
  it("a grant has at most one award", async () => {
    const result = await asUser(world.alice, () =>
      attempt(
        db,
        ...insertSql("awards", {
          ...rowFor("awards", world.A, world.alice),
          grant_id: world.A.grantId,
        }),
      ),
    );
    expect(result.error?.message).toMatch(/duplicate key|unique/);
  });

  it("an award cannot point at another organization's grant", async () => {
    // As the owner role, so the foreign key itself is what refuses it.
    const result = await attempt(
      db,
      ...insertSql("awards", {
        ...rowFor("awards", world.A, world.alice),
        grant_id: world.B.spareGrantId,
      }),
    );
    expect(result.error?.message).toMatch(/foreign key/);
  });

  it("an indirect rate needs a negotiated or other method", async () => {
    const result = await asUser(world.alice, () =>
      attempt(
        db,
        "update public.awards set indirect_method = 'de_minimis', indirect_rate = 12.5 where id = $1",
        [world.A.awardId],
      ),
    );
    expect(result.error?.message).toMatch(/awards_rate_needs_method/);
  });

  it("only an admin deletes an award; an editor cannot", async () => {
    const rows = await asUser(world.ed, async () => {
      const result = await attempt(db, "delete from public.awards where id = $1 returning id", [
        world.A.awardId,
      ]);
      return result.rows ?? [];
    });
    expect(rows).toEqual([]);
    const deleted = await asUser(world.alice, async () => {
      const result = await attempt(db, "delete from public.awards where id = $1 returning id", [
        world.A.awardId,
      ]);
      return result.rows ?? [];
    });
    expect(deleted).toHaveLength(1);
  });

  it("a viewer reads the award but cannot change it", async () => {
    const { seen, changed } = await asUser(world.amy, async () => {
      const seen = await db.query<{ id: string }>("select id from public.awards");
      const result = await attempt(
        db,
        "update public.awards set award_number = 'X' where id = $1 returning id",
        [world.A.awardId],
      );
      return { seen, changed: result.rows ?? [] };
    });
    expect(seen.map((r) => r.id)).toContain(world.A.awardId);
    expect(changed).toEqual([]);
  });
});

describe("report schedule and the calendar", () => {
  it("adding a report creates one all-day deadline on the same grant", async () => {
    const deadline = await asUser(world.ed, async () => {
      const [row] = await db.query<{ id: string }>(
        ...insertSql("award_reports", {
          ...rowFor("award_reports", world.A, world.ed),
          title: "SF-425 financial report, Q1",
          due_date: "2027-04-30",
        }),
      );
      await db.exec("reset role");
      return deadlineFor(row.id);
    });
    expect(deadline).toBeDefined();
    expect(deadline!.organization_id).toBe(world.A.id);
    expect(deadline!.grant_id).toBe(world.A.grantId);
    expect(deadline!.kind).toBe("report");
    expect(deadline!.all_day).toBe(true);
    expect(deadline!.title).toBe("SF-425 financial report, Q1");
    expect(new Date(deadline!.due_at).toISOString()).toBe("2027-04-30T12:00:00.000Z");
  });

  it("changing the due date moves the deadline instead of adding one", async () => {
    const { deadline, deadlines } = await asUser(world.ed, async () => {
      const [row] = await db.query<{ id: string }>(
        ...insertSql("award_reports", rowFor("award_reports", world.A, world.ed)),
      );
      await db.query(
        "update public.award_reports set due_date = '2027-05-15', title = 'Moved' where id = $1",
        [row.id],
      );
      await db.exec("reset role");
      const deadlines = await db.query<{ id: string }>(
        "select id from public.deadlines where grant_id = $1 and kind = 'report'",
        [world.A.grantId],
      );
      return { deadline: await deadlineFor(row.id), deadlines };
    });
    expect(deadline!.title).toBe("Moved");
    expect(new Date(deadline!.due_at).toISOString()).toBe("2027-05-15T12:00:00.000Z");
    // The fixture report plus this one: nothing duplicated.
    expect(deadlines).toHaveLength(2);
  });

  it("deleting a report removes its deadline", async () => {
    const remaining = await asUser(world.ed, async () => {
      const [row] = await db.query<{ id: string; deadline_id: string }>(
        "insert into public.award_reports (organization_id, award_id, title, due_date, created_by) values ($1, $2, 'Gone', '2027-06-01', $3) returning id, deadline_id",
        [world.A.id, world.A.awardId, world.ed],
      );
      await db.query("delete from public.award_reports where id = $1", [row.id]);
      await db.exec("reset role");
      return db.query("select id from public.deadlines where id = $1", [row.deadline_id]);
    });
    expect(remaining).toEqual([]);
  });

  it("the generator cannot write the same report twice", async () => {
    const result = await asUser(world.ed, async () => {
      const values = {
        ...rowFor("award_reports", world.A, world.ed),
        kind: "final_financial",
        due_date: "2028-04-29",
        generated: true,
      };
      await db.query(...insertSql("award_reports", values));
      return attempt(db, ...insertSql("award_reports", values));
    });
    expect(result.error?.message).toMatch(/duplicate key|award_reports_generated_key/);
  });

  it("a submitted report needs the date it was sent", async () => {
    const result = await asUser(world.ed, () =>
      attempt(db, "update public.award_reports set status = 'submitted' where id = $1", [
        world.A.rows.award_reports,
      ]),
    );
    expect(result.error?.message).toMatch(/award_reports_submitted_needs_date/);
  });

  it("a report cannot hang off another organization's award", async () => {
    const result = await attempt(
      db,
      ...insertSql("award_reports", {
        ...rowFor("award_reports", world.A, world.alice),
        award_id: world.B.awardId,
      }),
    );
    expect(result.error?.message).toMatch(/foreign key/);
  });
});

describe("budget versus actual", () => {
  it("an actual must sit on a line of the same award", async () => {
    // A second award in organization A, with its own line.
    const grant = await insertRow(db, "grants", rowFor("grants", world.A, world.alice));
    const award = await insertRow(db, "awards", {
      ...rowFor("awards", world.A, world.alice),
      grant_id: grant.id,
    });
    const result = await asUser(world.ed, () =>
      attempt(
        db,
        ...insertSql("budget_actuals", {
          ...rowFor("budget_actuals", world.A, world.ed),
          award_id: award.id,
          budget_line_id: world.A.budgetLineId,
        }),
      ),
    );
    expect(result.error?.message).toMatch(/foreign key/);
  });

  it("a category appears once per award, whatever its capitalisation", async () => {
    const result = await asUser(world.ed, async () => {
      await db.query(
        ...insertSql("budget_lines", {
          ...rowFor("budget_lines", world.A, world.ed),
          category: "Personnel",
        }),
      );
      return attempt(
        db,
        ...insertSql("budget_lines", {
          ...rowFor("budget_lines", world.A, world.ed),
          category: "  personnel ",
        }),
      );
    });
    expect(result.error?.message).toMatch(/duplicate key|budget_lines_award_category/);
  });

  it("deleting an award removes its reports, lines, actuals, reimbursements and items", async () => {
    const counts = await asUser(world.alice, async () => {
      await db.query("delete from public.awards where id = $1", [world.A.awardId]);
      await db.exec("reset role");
      const [row] = await db.query<{ n: string }>(
        `select (select count(*) from public.award_reports where award_id = $1)
              + (select count(*) from public.budget_lines where award_id = $1)
              + (select count(*) from public.budget_actuals where award_id = $1)
              + (select count(*) from public.reimbursements where award_id = $1)
              + (select count(*) from public.compliance_items where award_id = $1) as n`,
        [world.A.awardId],
      );
      return Number(row.n);
    });
    expect(counts).toBe(0);
  });
});
