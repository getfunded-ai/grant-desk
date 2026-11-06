#!/usr/bin/env node
// Local only: makes a person who has signed in to the local app an owner of the demo organization
// that supabase/seed.sql creates. Usage: node scripts/db/join-demo-org.mjs you@example.com
// Refuses any database that is not the local Supabase stack on this machine.

import { execFileSync } from "node:child_process";

import pg from "pg";

const DEMO_ORG = "00000000-0000-4000-8000-00000000d001";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/db/join-demo-org.mjs <email you signed in with locally>");
  process.exit(1);
}

const status = JSON.parse(execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8" }));
const url = status.DB_URL;
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
  console.error("The local Supabase stack is not running. Start it with: supabase start");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query("select id from auth.users where lower(email) = lower($1)", [
    email,
  ]);
  if (rows.length === 0) {
    console.error(`No local user with that email. Sign in once at http://127.0.0.1:3000 first.`);
    process.exitCode = 1;
  } else {
    await client.query(
      `insert into public.memberships (organization_id, user_id, role) values ($1, $2, 'owner')
       on conflict (organization_id, user_id) do update set role = 'owner'`,
      [DEMO_ORG, rows[0].id],
    );
    console.log("Done: you are an owner of Demo Organization (local only).");
  }
} finally {
  await client.end();
}
