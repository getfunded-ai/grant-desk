# Phase L: Team

Milestone 3: Full single-organization version (target 2027-01-22) · Tier: **high** · Runs with: K, M · Depends on: C

## Goal

Roles, invites, assignment, comments, and a digest, for teams of any size.

## Owns (work only here)

- `lib/permissions/**`
- `app/(app)/team/**`
- `components/team/**`
- `lib/notifications/**`
- `supabase/migrations/*_roles_*.sql`
- `tests/rls/**`

## Build

1. Roles owner, admin, editor, viewer enforced in RLS and in server actions.
2. Invites by email with expiry; task assignment; comments and @mentions; activity feed; digest settings.
3. RLS tests for each role.

## Done when

- A viewer cannot edit; an editor cannot invite; tests prove it.

## Human steps

- None.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase L: Team.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-L.md first. Work only in the
folders the brief owns. Create the branch phase/l-team from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
