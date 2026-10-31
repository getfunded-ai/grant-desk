// Test database for the migration and row-level-security tests (allowed by the testing policy).
//
// Two backends, same tests:
// * Default (CI and any machine): PGlite, Postgres compiled to WebAssembly, in process. A small shim
//   recreates the parts of Supabase the migrations rely on (the anon, authenticated and service_role
//   roles, auth.users, auth.uid() and Supabase's default grants), then every file in
//   supabase/migrations is applied from empty, in order.
// * TEST_DATABASE_URL set: a local Supabase stack (`supabase start`, then `supabase db reset`). The
//   migrations are already applied by the CLI. Only localhost is accepted, never a hosted project.
//
// Each test file opens one connection, runs everything inside one transaction and rolls it back, so
// nothing is left behind on the local stack.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export type Row = Record<string, unknown>;

export interface Db {
  backend: "pglite" | "supabase";
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

// What Supabase provides before the first migration runs, reduced to what the migrations use.
const SUPABASE_SHIM = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant anon, authenticated, service_role to postgres;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
`;

async function openPglite(): Promise<Db> {
  const lite = new PGlite();
  await lite.exec(SUPABASE_SHIM);
  for (const file of migrationFiles()) {
    try {
      await lite.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return {
    backend: "pglite",
    async query<T extends Row>(sql: string, params: unknown[] = []) {
      return (await lite.query<T>(sql, params)).rows;
    },
    async exec(sql: string) {
      await lite.exec(sql);
    },
    async close() {
      await lite.close();
    },
  };
}

async function openSupabase(url: string): Promise<Db> {
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error(
      "TEST_DATABASE_URL must point at a local Supabase stack, never a hosted project",
    );
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return {
    backend: "supabase",
    async query<T extends Row>(sql: string, params: unknown[] = []) {
      return (await client.query(sql, params)).rows as T[];
    },
    async exec(sql: string) {
      await client.query(sql);
    },
    async close() {
      await client.end();
    },
  };
}

/** Opens the test database inside a transaction that close() rolls back. */
export async function openDb(): Promise<Db> {
  const url = process.env.TEST_DATABASE_URL;
  const db = url ? await openSupabase(url) : await openPglite();
  await db.exec("begin");
  return {
    ...db,
    async close() {
      await db.exec("rollback");
      await db.close();
    },
  };
}

export type Who = { role: "anon" } | { role: "authenticated"; userId: string | null };

let savepointCounter = 0;

/**
 * Runs fn as an API caller would reach the database: `anon`, or `authenticated` with the user's id in
 * the JWT claims. Everything fn does is rolled back afterwards, so each check starts from the same
 * fixtures. Inside fn, `reset role` switches back to the table owner to look at the result.
 */
export async function as<T>(db: Db, who: Who, fn: () => Promise<T>): Promise<T> {
  const savepoint = `as_${++savepointCounter}`;
  await db.exec(`savepoint ${savepoint}`);
  try {
    await db.exec(who.role === "anon" ? "set local role anon" : "set local role authenticated");
    const claims =
      who.role === "anon" || who.userId === null
        ? { role: who.role }
        : { role: who.role, sub: who.userId };
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    return await fn();
  } finally {
    await db.exec(`rollback to savepoint ${savepoint}; release savepoint ${savepoint}`);
  }
}

export type Attempt<T extends Row = Row> =
  { rows: T[]; error?: undefined } | { rows?: undefined; error: Error };

/** Runs one statement; a failure is returned instead of thrown and leaves the transaction usable. */
export async function attempt<T extends Row = Row>(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<Attempt<T>> {
  const savepoint = `attempt_${++savepointCounter}`;
  await db.exec(`savepoint ${savepoint}`);
  try {
    const rows = await db.query<T>(sql, params);
    await db.exec(`release savepoint ${savepoint}`);
    return { rows };
  } catch (error) {
    await db.exec(`rollback to savepoint ${savepoint}; release savepoint ${savepoint}`);
    return { error: error as Error };
  }
}

/** Inserts one row as the current role and returns it. Column names come from test code only. */
export async function insertRow(db: Db, table: string, values: Row): Promise<Row> {
  const columns = Object.keys(values);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const rows = await db.query(
    `insert into public.${table} (${columns.join(", ")}) values (${placeholders.join(", ")}) returning *`,
    Object.values(values),
  );
  return rows[0];
}

export function insertSql(table: string, values: Row): [string, unknown[]] {
  const columns = Object.keys(values);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  return [
    `insert into public.${table} (${columns.join(", ")}) values (${placeholders.join(", ")}) returning id`,
    Object.values(values),
  ];
}
