# Phase B: Data model and security

Milestone 1: Foundation (target 2026-11-13) · Tier: **high** · Runs with: C · Depends on: A

## Goal

A Supabase project with every version-1 table, row-level security on all of them, and generated types.

## Owns (work only here)

- `supabase/** (config, migrations, seed)`
- `lib/db/**`
- `types/supabase.ts`
- `scripts/db/**`
- `tests/db/** and tests/rls/**`

## Build

1. Create the Supabase project `grant-desk` (Zach confirms the cost prompt, H-3). Never touch the funder database behind the commons connector.
2. Migrations: organizations, memberships, profiles, funders, opportunities (CommonGrants shape: status, funding money fields, key dates, custom_fields jsonb, source url, external ids), grants (pipeline item: organization_id, funder_id or opportunity_id, stage, title, amounts, dates), grant_stage_history, tasks, deadlines, documents, notes, boilerplate, proposals (ledger: tool_name, summary, payload, status proposed/accepted/rejected), activity_log, external_feeds.
3. Stage check: prospect, qualifying, loi, application, submitted, awarded, declined, active, reporting, closed.
4. RLS: every tenant table scoped by membership in organization_id; helper function `is_member(org_id)`; no anon access; service role only from server code.
5. Seed script with one demo organization for local use only (never production).
6. Generated TypeScript types; typed server client in lib/db.
7. RLS and migration tests under tests/ (allowed by the testing policy).

## Done when

- Local Supabase starts; all migrations apply from empty.
- RLS tests prove a member of org A cannot read org B.
- `pnpm typecheck` passes with the generated types.

## Human steps

- H-3: confirm the Supabase project cost.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase B: Data model and security.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-B.md first. Work only in the
folders the brief owns. Create the branch phase/b-data-model-and-security from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
