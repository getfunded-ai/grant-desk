# Phase E: Pipeline, calendar, reminders

Milestone 1: Foundation (target 2026-11-13) · Tier: **high** · Runs with: D · Depends on: B, C

## Goal

The heart of the app: a board of grants by stage, a record page, a calendar, feeds in and out, and email reminders.

## Owns (work only here)

- `app/(app)/grants/**`
- `app/(app)/calendar/**`
- `app/api/ical/**`
- `app/api/cron/reminders/**`
- `lib/pipeline/**`
- `lib/calendar/**`
- `lib/email/**`
- `components/pipeline/**`
- `components/calendar/**`
- `supabase/migrations/*_feeds_*.sql`

## Build

1. Board by stage with drag between stages; an SBIR preset (pitch → invited → full application → go/no-go) as stage labels on the same stages.
2. Grant record: funder, amounts asked and awarded, key dates, contacts, notes, tasks, files list, timeline from activity_log, proposals list with accept/reject.
3. Calendar of deadlines and tasks; iCal feed per organization (signed token URL).
4. Subscribe to outside iCal and RSS feeds (external_feeds); first target: the DOE SBIR hub iCal and RSS.
5. Resend reminders at 30, 14, 7 and 1 days on a cron; per-user digest setting.

## Done when

- Create a grant, move it across stages, see the timeline update.
- Subscribe the DOE hub iCal; its dates appear on the calendar.
- The iCal feed opens in a calendar app once.
- A reminder email arrives on a test address once.

## Human steps

- H-4 must be done for email to send.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase E: Pipeline, calendar, reminders.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-E.md first. Work only in the
folders the brief owns. Create the branch phase/e-pipeline-calendar-reminders from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
