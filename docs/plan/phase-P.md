# Phase P: Portfolio layer

Milestone 4: Consultant version (target 2027-02-19) · Tier: **high** · Runs with: — · Depends on: L

## Goal

A consultant sees every client in one place: one calendar, one dashboard, a one-click switcher.

## Owns (work only here)

- `app/(portfolio)/**`
- `lib/portfolio/**`
- `components/portfolio/**`
- `supabase/migrations/*_portfolio_*.sql`
- `tests/rls/portfolio.*`

## Build

1. Portfolio view across the organizations a user belongs to; cross-client calendar; dashboard with workload by client; client tags.
2. Switcher always one click away; the current organization is always visible.
3. RLS tests: a consultant sees only organizations they belong to; a client staff user sees only their own.

## Done when

- Two organizations, one calendar; switching takes one click; tests pass.

## Human steps

- None.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase P: Portfolio layer.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-P.md first. Work only in the
folders the brief owns. Create the branch phase/p-portfolio-layer from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
