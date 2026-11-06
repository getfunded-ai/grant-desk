// Migrations apply from empty, and the structure keeps the data rules: every table has row-level
// security and policies, every tenant table has organization_id, anon has no privileges, and the
// pipeline has its ten stages in order.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ALL_PUBLIC_TABLES, CATALOG_TABLES } from "../rls/fixtures";
import { type Db, migrationFiles, openDb } from "./harness";

let db: Db;

beforeAll(async () => {
  // On PGlite this applies every migration from an empty database; a failure fails the suite here.
  db = await openDb();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

async function publicTables(): Promise<string[]> {
  const rows = await db.query<{ name: string }>(
    "select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1",
  );
  return rows.map((r) => r.name);
}

describe("migrations", () => {
  it("are named <timestamp>_<name>.sql and sorted", () => {
    const files = migrationFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
  });

  it("are all applied (on the local Supabase stack, all recorded by the CLI)", async () => {
    if (db.backend === "pglite") {
      expect(await publicTables()).not.toHaveLength(0);
      return;
    }
    const rows = await db.query<{ version: string }>(
      "select version from supabase_migrations.schema_migrations order by 1",
    );
    expect(rows.map((r) => r.version)).toEqual(migrationFiles().map((f) => f.slice(0, 14)));
  });

  it("create exactly the tables the RLS tests cover", async () => {
    // A new table must be added to tests/rls/fixtures.ts, which puts it under the isolation tests.
    expect(await publicTables()).toEqual([...ALL_PUBLIC_TABLES].sort());
  });
});

describe("the data rules hold for every table in public", () => {
  it("row-level security is on", async () => {
    const off = await db.query(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity",
    );
    expect(off).toEqual([]);
  });

  it("every table has at least one policy, and none is for anon or public", async () => {
    const tables = await publicTables();
    const policies = await db.query<{ tablename: string; roles: string[] | string }>(
      "select tablename, roles from pg_policies where schemaname = 'public'",
    );
    for (const table of tables) expect(policies.some((p) => p.tablename === table)).toBe(true);
    for (const policy of policies) {
      const roles = Array.isArray(policy.roles)
        ? policy.roles
        : String(policy.roles).replace(/[{}]/g, "").split(",");
      expect(roles).toEqual(["authenticated"]);
    }
  });

  it("every tenant table has a non-null organization_id (the catalog tables and the two people tables aside)", async () => {
    const rows = await db.query<{ table_name: string; is_nullable: string }>(
      "select table_name, is_nullable from information_schema.columns where table_schema = 'public' and column_name = 'organization_id'",
    );
    const byTable = new Map(rows.map((r) => [r.table_name, r.is_nullable]));
    for (const table of await publicTables()) {
      if (table === "organizations" || table === "profiles") continue;
      if ((CATALOG_TABLES as readonly string[]).includes(table)) continue;
      expect(byTable.has(table), `${table} has organization_id`).toBe(true);
      if (table !== "opportunities")
        expect(byTable.get(table), `${table}.organization_id is not null`).toBe("NO");
    }
  });

  it("anon holds no privilege on any table, sequence or function in public or private", async () => {
    const tables = await db.query(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S') and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger') or has_any_column_privilege('anon', c.oid, 'select,insert,update,references'))",
    );
    expect(tables).toEqual([]);
    const functions = await db.query(
      "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')",
    );
    expect(functions).toEqual([]);
    const [schema] = await db.query<{ usage: boolean }>(
      "select has_schema_privilege('anon', 'private', 'usage') as usage",
    );
    expect(schema.usage).toBe(false);
  });

  it("every function in public and private pins its search_path", async () => {
    const rows = await db.query(
      "select n.nspname || '.' || p.proname as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))",
    );
    expect(rows).toEqual([]);
  });
});

describe("the pipeline", () => {
  it("has exactly the ten pipeline stages, in order", async () => {
    const rows = await db.query<{ label: string }>(
      "select e.enumlabel as label from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'grant_stage' order by e.enumsortorder",
    );
    expect(rows.map((r) => r.label)).toEqual([
      "prospect",
      "qualifying",
      "loi",
      "application",
      "submitted",
      "awarded",
      "declined",
      "active",
      "reporting",
      "closed",
    ]);
  });

  it("proposals start as proposed and can only be accepted or rejected", async () => {
    const rows = await db.query<{ label: string }>(
      "select e.enumlabel as label from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'proposal_status' order by e.enumsortorder",
    );
    expect(rows.map((r) => r.label)).toEqual(["proposed", "accepted", "rejected"]);
  });
});
