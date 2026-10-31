# Phase Y: Security, privacy, operations

Milestone 5: Growth engine and operations (target 2027-03-26) · Tier: **high** · Runs with: X · Depends on: L

## Goal

Ready for strangers: audited security, deletion flows, legal pages, accessibility, backups.

## Owns (work only here)

- `lib/deletion/**`
- `app/(app)/settings/delete/**`
- `tests/deletion/**`
- `docs/policies/**`
- `app/(marketing)/legal/**`
- `lib/rate-limit/**`

## Build

1. RLS audit across every table; rate limits on public and AI routes; backups verified; Supabase advisor fixes.
2. Account and organization deletion with a grace period and tests.
3. Terms and Privacy pages from counsel-approved drafts; a plain-words data retention policy.
4. Accessibility pass to WCAG 2.2 AA on the main flows.

## Done when

- Deletion tests pass; advisors show no high findings; legal pages live.

## Human steps

- H-11: counsel approves the drafts.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase Y: Security, privacy, operations.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-Y.md first. Work only in the
folders the brief owns. Create the branch phase/y-security-privacy-operations from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
