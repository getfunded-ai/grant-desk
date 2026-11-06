// Phase D: the Grants.gov catalog. The batch upsert only server code may call, the activity_log
// lines tracked grants get when an opportunity's status or close date changes, the search function
// the browse page uses (row-level security applies through it), and the reference tables that
// every signed-in person reads and nobody but server code writes.

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CATALOG_TABLES, type World, buildWorld, rowFor } from "../rls/fixtures";
import { type Db, type Row, as, attempt, insertRow, openDb } from "./harness";

let db: Db;
let world: World;

beforeAll(async () => {
  db = await openDb();
  world = await buildWorld(db);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const asUser = <T>(userId: string | null, fn: () => Promise<T>) =>
  as(db, { role: "authenticated", userId }, fn);

type UpsertCounts = { inserted: number; updated: number; unchanged: number };

/** Calls the upsert as server code would (the table owner here, the service role in production). */
async function upsert(rows: Row[]): Promise<UpsertCounts> {
  const [counts] = await db.query<UpsertCounts>(
    "select * from public.upsert_catalog_opportunities('grants_gov', $1::jsonb)",
    [JSON.stringify(rows)],
  );
  return counts;
}

function catalogRow(externalId: string, overrides: Row = {}): Row {
  return {
    title: `Community Health Workers Program ${externalId}`,
    description: "<p>Support for community clinics.</p>",
    status: "open",
    funder_name: "Health Resources and Services Administration",
    post_date: "2026-11-01",
    close_date: "2027-01-15",
    max_award_amount: 500000,
    source_url: `https://www.grants.gov/search-results-detail/${externalId}`,
    external_id: externalId,
    opportunity_number: `HRSA-27-${externalId}`,
    external_ids: { grants_gov_opportunity_id: Number(externalId) },
    custom_fields: {
      grants_gov: {
        agency_code: "HHS-HRSA",
        eligible_applicants: ["12", "13"],
        funding_categories: ["HL"],
      },
    },
    ...overrides,
  };
}

async function catalogId(externalId: string): Promise<string> {
  const [row] = await db.query<{ id: string }>(
    "select id from public.opportunities where source_system = 'grants_gov' and external_id = $1 and organization_id is null",
    [externalId],
  );
  return row.id;
}

describe("the catalog upsert", () => {
  it("inserts new catalog rows and reports the counts", async () => {
    const counts = await upsert([catalogRow("900001"), catalogRow("900002")]);
    expect(counts).toEqual({ inserted: 2, updated: 0, unchanged: 0 });
    const rows = await db.query<Row>(
      "select organization_id, source_system, created_by, status, close_date, max_award_amount, search is not null as searchable from public.opportunities where external_id in ('900001', '900002') order by external_id",
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.organization_id).toBeNull();
      expect(row.source_system).toBe("grants_gov");
      expect(row.created_by).toBeNull();
      expect(row.status).toBe("open");
      expect(row.searchable).toBe(true);
    }
  });

  it("leaves a row alone when nothing changed, and updates it when something did", async () => {
    const [before] = await db.query<{ updated_at: string }>(
      "select updated_at from public.opportunities where external_id = '900001' and organization_id is null",
    );
    expect(await upsert([catalogRow("900001")])).toEqual({
      inserted: 0,
      updated: 0,
      unchanged: 1,
    });
    const [same] = await db.query<{ updated_at: string }>(
      "select updated_at from public.opportunities where external_id = '900001' and organization_id is null",
    );
    expect(same.updated_at).toEqual(before.updated_at);

    expect(await upsert([catalogRow("900001", { close_date: "2027-02-01" })])).toEqual({
      inserted: 0,
      updated: 1,
      unchanged: 0,
    });
    const [changed] = await db.query<{ close_date: string }>(
      "select close_date::text as close_date from public.opportunities where external_id = '900001' and organization_id is null",
    );
    expect(changed.close_date).toBe("2027-02-01");
  });

  it("keeps unknown money unknown, never zero", async () => {
    await upsert([
      catalogRow("900003", {
        max_award_amount: undefined,
        min_award_amount: undefined,
        total_amount_available: undefined,
      }),
    ]);
    const [row] = await db.query<Row>(
      "select total_amount_available, min_award_amount, max_award_amount, estimated_award_count from public.opportunities where external_id = '900003' and organization_id is null",
    );
    expect(Object.values(row)).toEqual([null, null, null, null]);
  });

  it("refuses anything but an array of rows", async () => {
    const result = await attempt(
      db,
      "select * from public.upsert_catalog_opportunities('grants_gov', '{}'::jsonb)",
    );
    expect(result.error?.message).toMatch(/JSON array/);
  });

  it("cannot be called with a signed-in session", async () => {
    const result = await asUser(world.alice, () =>
      attempt(db, "select * from public.upsert_catalog_opportunities('grants_gov', '[]'::jsonb)"),
    );
    expect(result.error?.message).toMatch(/permission denied/);
  });
});

describe("tracked grants hear about changes", () => {
  let trackedId: string;
  let grantA: string;
  let grantB: string;

  beforeAll(async () => {
    await upsert([catalogRow("900010"), catalogRow("900011")]);
    trackedId = await catalogId("900010");
    const a = await insertRow(db, "grants", {
      ...rowFor("grants", world.A, world.alice),
      opportunity_id: trackedId,
    });
    const b = await insertRow(db, "grants", {
      ...rowFor("grants", world.B, world.bob),
      opportunity_id: trackedId,
    });
    grantA = a.id as string;
    grantB = b.id as string;
  });

  const changeLines = (grantId: string) =>
    db.query<Row>(
      "select organization_id, actor_kind, actor_id, action, summary, details from public.activity_log where grant_id = $1 and action = 'opportunity.changed' order by created_at",
      [grantId],
    );

  it("writes one system line per tracking grant, each in its own organization", async () => {
    await upsert([catalogRow("900010", { status: "closed", close_date: "2026-12-01" })]);
    const [linesA, linesB] = await Promise.all([changeLines(grantA), changeLines(grantB)]);
    expect(linesA).toHaveLength(1);
    expect(linesB).toHaveLength(1);
    expect(linesA[0].organization_id).toBe(world.A.id);
    expect(linesB[0].organization_id).toBe(world.B.id);
    for (const line of [linesA[0], linesB[0]]) {
      expect(line.actor_kind).toBe("system");
      expect(line.actor_id).toBeNull();
      expect(line.summary).toMatch(/status changed from open to closed/);
      expect(line.summary).toMatch(/close date changed from 2027-01-15 to 2026-12-01/);
      expect(line.details).toMatchObject({
        opportunity_id: trackedId,
        source_system: "grants_gov",
        from: { status: "open", close_date: "2027-01-15" },
        to: { status: "closed", close_date: "2026-12-01" },
      });
    }
  });

  it("says 'not stated' when a close date disappears, never a made-up date", async () => {
    await upsert([catalogRow("900010", { status: "closed", close_date: undefined })]);
    const lines = await changeLines(grantA);
    expect(lines).toHaveLength(2);
    expect(lines[1].summary).toMatch(/close date changed from 2026-12-01 to not stated/);
    expect(lines[1].summary).not.toMatch(/status changed/);
  });

  it("writes nothing for a change to other fields, or for an untracked opportunity", async () => {
    await upsert([
      catalogRow("900010", { status: "closed", close_date: undefined, title: "Renamed" }),
      catalogRow("900011", { status: "closed", close_date: "2026-12-01" }),
    ]);
    expect(await changeLines(grantA)).toHaveLength(2);
    const [{ n }] = await db.query<{ n: number }>(
      "select count(*)::int as n from public.activity_log where action = 'opportunity.changed' and details ->> 'opportunity_id' = $1",
      [await catalogId("900011")],
    );
    expect(n).toBe(0);
  });

  it("stays out of an organization's own opportunities", async () => {
    await db.query("update public.opportunities set status = 'closed' where id = $1", [
      world.A.opportunityId,
    ]);
    expect(await changeLines(world.A.grantId)).toHaveLength(0);
  });

  it("never touches the grant itself", async () => {
    const [grant] = await db.query<Row>(
      "select stage, updated_at from public.grants where id = $1",
      [grantA],
    );
    expect(grant.stage).toBe("prospect");
    const [{ n }] = await db.query<{ n: number }>(
      "select count(*)::int as n from public.grant_stage_history where grant_id = $1",
      [grantA],
    );
    expect(n).toBe(1); // only the line written when the grant was created
  });
});

describe("search_opportunities", () => {
  type Hit = {
    id: string;
    title: string;
    status: string;
    agency_code: string | null;
    max_award_amount: string | null;
    eligible_applicants: string[];
    total_count: number | string;
  };

  // Array arguments travel as Postgres array literals ('{12,13}'), which both backends accept.
  const search = (userId: string | null, args: Record<string, unknown>) =>
    asUser(userId, () => {
      const names = Object.keys(args);
      const params = names.map((name, i) => `${name} := $${i + 1}`).join(", ");
      const values = Object.values(args).map((value) =>
        Array.isArray(value) ? `{${value.join(",")}}` : value,
      );
      return db.query<Hit>(
        `select id, title, status, agency_code, max_award_amount, eligible_applicants, total_count from public.search_opportunities(${params})`,
        values,
      );
    });

  beforeAll(async () => {
    await upsert([
      catalogRow("900020", {
        title: "Rural Clinic Telehealth Expansion",
        description: "<p>Telehealth equipment for rural clinics.</p>",
        close_date: "2027-03-31",
        max_award_amount: 750000,
      }),
      catalogRow("900021", {
        title: "Wildlife Habitat Restoration",
        description: "<p>Restore wetlands.</p>",
        funder_name: "Fish and Wildlife Service",
        close_date: "2027-02-28",
        max_award_amount: undefined,
        custom_fields: {
          grants_gov: {
            agency_code: "DOI-FWS",
            eligible_applicants: ["00", "06"],
            funding_categories: ["ENV", "NR"],
          },
        },
      }),
      catalogRow("900022", {
        title: "Youth Mentoring Forecast",
        status: "forecasted",
        status_description: "Forecast on Grants.gov; dates are estimates",
        close_date: undefined,
        max_award_amount: 100000,
        custom_fields: {
          grants_gov: {
            agency_code: "HHS-ACF",
            eligible_applicants: ["12"],
            funding_categories: ["ISS"],
          },
        },
      }),
    ]);
  });

  it("finds opportunities by words in the title or description, and by number", async () => {
    const byWord = await search(world.alice, {
      p_keyword: "telehealth",
      p_source_system: "grants_gov",
    });
    expect(byWord.map((h) => h.title)).toEqual(["Rural Clinic Telehealth Expansion"]);
    const byNumber = await search(world.alice, {
      p_keyword: "HRSA-27-900021",
      p_source_system: "grants_gov",
    });
    expect(byNumber.map((h) => h.title)).toEqual(["Wildlife Habitat Restoration"]);
  });

  it("filters by nonprofit eligibility, agency, category, status and close date", async () => {
    const nonprofit = await search(world.alice, {
      p_eligibilities: ["12", "13"],
      p_source_system: "grants_gov",
    });
    expect(nonprofit.map((h) => h.title)).not.toContain("Wildlife Habitat Restoration");
    expect(nonprofit.map((h) => h.title)).toContain("Rural Clinic Telehealth Expansion");

    const department = await search(world.alice, {
      p_agency: "HHS",
      p_source_system: "grants_gov",
    });
    expect(new Set(department.map((h) => h.agency_code))).toEqual(new Set(["HHS-HRSA", "HHS-ACF"]));
    const agency = await search(world.alice, {
      p_agency: "HHS-ACF",
      p_source_system: "grants_gov",
    });
    expect(agency.map((h) => h.title)).toEqual(["Youth Mentoring Forecast"]);

    const category = await search(world.alice, {
      p_categories: ["NR"],
      p_source_system: "grants_gov",
    });
    expect(category.map((h) => h.title)).toEqual(["Wildlife Habitat Restoration"]);

    const forecast = await search(world.alice, {
      p_statuses: ["forecasted"],
      p_source_system: "grants_gov",
    });
    expect(forecast.map((h) => h.title)).toEqual(["Youth Mentoring Forecast"]);

    const window = await search(world.alice, {
      p_close_from: "2027-03-01",
      p_close_to: "2027-03-31",
      p_source_system: "grants_gov",
    });
    expect(window.map((h) => h.title)).toEqual(["Rural Clinic Telehealth Expansion"]);
  });

  it("a money filter never matches an amount that is not stated", async () => {
    const hits = await search(world.alice, {
      p_min_award_ceiling: 600000,
      p_source_system: "grants_gov",
    });
    expect(hits.map((h) => h.title)).toEqual(["Rural Clinic Telehealth Expansion"]);
    const unstated = await search(world.alice, {
      p_keyword: "wildlife",
      p_source_system: "grants_gov",
    });
    expect(unstated[0].max_award_amount).toBeNull();
  });

  it("reports the total across pages", async () => {
    const page = await search(world.alice, {
      p_agency: "HHS",
      p_source_system: "grants_gov",
      p_limit: 1,
    });
    expect(page).toHaveLength(1);
    const all = await search(world.alice, { p_agency: "HHS", p_source_system: "grants_gov" });
    expect(Number(page[0].total_count)).toBe(all.length);
    expect(all.length).toBeGreaterThan(1);
  });

  it("shows the catalog and the caller's own organizations' rows, never another organization's", async () => {
    const alice = await search(world.alice, {});
    const ids = alice.map((h) => h.id);
    expect(ids).toContain(world.A.opportunityId);
    expect(ids).not.toContain(world.B.opportunityId);
    expect(ids).toContain(world.catalogOpportunityId);

    const nina = await search(world.nina, {});
    expect(nina.map((h) => h.id)).not.toContain(world.A.opportunityId);
    expect(nina.map((h) => h.id)).toContain(world.catalogOpportunityId);
  });

  it("is not available to anonymous callers", async () => {
    const result = await as(db, { role: "anon" }, () =>
      attempt(db, "select * from public.search_opportunities()"),
    );
    expect(result.error?.message).toMatch(/permission denied/);
  });
});

describe("the reference tables and the run log", () => {
  let detailsFor: string;

  beforeAll(async () => {
    await upsert([catalogRow("900030")]);
    detailsFor = await catalogId("900030");
    await insertRow(db, "grants_gov_agencies", {
      code: "HHS-HRSA",
      name: "Health Resources and Services Administration",
      top_agency_code: "HHS",
    });
    await insertRow(db, "assistance_listings", { number: "93.912", title: "Rural Health" });
    await insertRow(db, "opportunity_details", {
      opportunity_id: detailsFor,
      source_system: "grants_gov",
      packages: [{ package_id: "PKG00000001" }],
    });
    await insertRow(db, "opportunity_details", {
      opportunity_id: world.B.opportunityId,
      source_system: "manual",
    });
    await insertRow(db, "opportunity_sync_runs", {
      source_system: "grants_gov",
      job: "nightly",
      status: "succeeded",
    });
  });

  it.each(CATALOG_TABLES)("%s: every signed-in person reads it", async (table) => {
    const rows = await asUser(world.nina, () => db.query(`select * from public.${table}`));
    expect(rows.length).toBeGreaterThan(0);
  });

  // One column per table a write attempt touches.
  const TOUCH: Record<(typeof CATALOG_TABLES)[number], string> = {
    grants_gov_agencies: "name",
    assistance_listings: "title",
    opportunity_details: "source_system",
    opportunity_sync_runs: "status",
  };

  it.each(CATALOG_TABLES)("%s: a signed-in person cannot write it", async (table) => {
    const { insert, update, del } = await asUser(world.alice, async () => ({
      insert: await attempt(
        db,
        `insert into public.${table} select * from public.${table} limit 0`,
      ),
      update: await attempt(db, `update public.${table} set ${TOUCH[table]} = 'x' where false`),
      del: await attempt(db, `delete from public.${table} where false`),
    }));
    expect(insert.error?.message).toMatch(/permission denied/);
    expect(update.error?.message).toMatch(/permission denied/);
    expect(del.error?.message).toMatch(/permission denied/);
  });

  it.each(CATALOG_TABLES)("%s: anonymous callers get nothing", async (table) => {
    const result = await as(db, { role: "anon" }, () =>
      attempt(db, `select * from public.${table}`),
    );
    expect(result.error?.message).toMatch(/permission denied/);
  });

  it("details follow their opportunity across the data wall", async () => {
    const alice = await asUser(world.alice, () =>
      db.query<{ opportunity_id: string }>("select opportunity_id from public.opportunity_details"),
    );
    expect(alice.map((r) => r.opportunity_id)).toEqual([detailsFor]);
    const bob = await asUser(world.bob, () =>
      db.query<{ opportunity_id: string }>("select opportunity_id from public.opportunity_details"),
    );
    expect(bob.map((r) => r.opportunity_id).sort()).toEqual(
      [detailsFor, world.B.opportunityId].sort(),
    );
  });

  it("a sync run only takes the statuses and jobs it knows", async () => {
    const bad = await attempt(
      db,
      "insert into public.opportunity_sync_runs (source_system, job) values ('grants_gov', 'weekly')",
    );
    expect(bad.error?.message).toMatch(/check constraint/);
  });

  it("a detail row disappears with its opportunity", async () => {
    const id = randomUUID();
    await db.query(
      "insert into public.opportunities (id, title, status, source_system, external_id) values ($1, 'Temporary', 'open', 'grants_gov', 'tmp-1')",
      [id],
    );
    await insertRow(db, "opportunity_details", { opportunity_id: id, source_system: "grants_gov" });
    await db.query("delete from public.opportunities where id = $1", [id]);
    const rows = await db.query(
      "select 1 from public.opportunity_details where opportunity_id = $1",
      [id],
    );
    expect(rows).toEqual([]);
  });
});
