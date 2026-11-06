# Database

Grant Desk's own Supabase project (`grant-desk`). Never the funder database behind the commons
connector (ADR-0001).

## Local work

```sh
supabase start                 # Docker must be running
supabase db reset              # applies every migration from empty, then seed.sql
pnpm db:types                  # regenerates types/supabase.ts after a migration
pnpm exec vitest run tests     # migration and RLS tests on PGlite (no Docker needed; CI runs this)
pnpm test:db:local             # the same tests against the local Supabase stack
node scripts/db/join-demo-org.mjs you@example.com   # after signing in locally once
```

`seed.sql` creates one made-up demo organization. It is for the local stack only.

## The model

- Tenants: `organizations`, `memberships` (owner, admin, editor, viewer), `profiles` (one per person).
  A person creates an organization with `create_organization(name)` and becomes its owner.
- Pipeline: `funders`, `opportunities` (CommonGrants shape; `organization_id` null is the
  shared public catalog that only server code writes), `grants` (ten stages), `grant_stage_history`
  (written by a trigger), `proposals` (AI and agents propose, a person accepts or rejects once),
  `activity_log` (append-only).
- Work items: `external_feeds`, `deadlines`, `tasks`, `documents`, `notes`, `boilerplate`.

Security: every table has row-level security; tenant rows are visible to members of their
organization only; viewers read, editors write, admins delete grants and funders and change
members' roles. Nobody adds another person with a signed-in session: members join through
`create_organization` or through server code that has checked the invitee accepted.
The `anon` role has no privileges at all. Child rows reference their parent through
`(organization_id, id)`, so nothing can be attached across organizations. A document's storage
path must be its organization's id followed by plain segments (no `..`), so it cannot reach
another organization's folder. Helpers live in the
schema `private`, which the Data API does not expose.

## A new migration

Add `supabase/migrations/<yyyymmddhhmmss>_<name>.sql`. A new table must enable row-level security,
grant nothing to `anon`, and be added to `tests/rls/fixtures.ts`; `tests/db/migrations.test.ts` fails
until it is.

## The hosted project

Migrations are applied to the hosted project only after the pull request merges, by the maintainer or
with their go-ahead: `supabase link --project-ref <project ref>` then `supabase db push`. Never
`--include-seed`.
