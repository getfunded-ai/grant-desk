# Progress

Living status. Every agent updates its own phase row and its own session-log lines after every task.

## Phases

| Phase | Name                    | Status      | Pull request                       | Verified by                                                       |
| ----- | ----------------------- | ----------- | ---------------------------------- | ----------------------------------------------------------------- |
| A     | Repo and guardrails     | done        | merged before the repo went public | format, typecheck, lint, build; three fresh-context review rounds |
| B     | Data model and security | in review   | #28                                | db reset, advisors, typecheck, lint, build; 262 tests             |
| C     | Login, shell, deploy    | done        | #29 (merged 2026-11-06)            | typecheck, lint, format, two builds; 66 sign-in tests             |
| E     | Pipeline and calendar   | in review   | #31                                | typecheck, lint, format, build; 346 tests; feed readers by hand   |
| D–Z   | see ROADMAP.md          | not started |                                    |                                                                   |

## Decisions

| Topic                     | Decision                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| Licence                   | MIT                                                                                              |
| Hosting                   | Vercel                                                                                           |
| Database, sign-in, files  | Supabase (a project of its own, never the funder database)                                       |
| Billing for the US$1 tier | Dollar App Store; one-time US$1 = lifetime personal licence; US$1/month adds the monthly webinar |
| AI                        | Anthropic API from Phase K; users may bring their own key                                        |
| Address                   | a vercel.app address until launch, then under getfunded.ai                                       |

## Session log

- 2026-10-31: Repository published with a clean history. Phase A complete. Phases B and C started.
- 2026-10-31: Phase B rebased onto the public history. Fifteen tables, row-level security on all of
  them, 262 migration and RLS tests (PGlite and the local Supabase stack), three review rounds. Nothing
  applied to the hosted database yet; that waits for the maintainer after merge.
- 2026-11-05 (Phase E): Pipeline board, grant record, calendar, outside feeds, the organization's
  own iCal address and reminder emails, in pull request #31 on branch `phase/e-pipeline-calendar-reminders` (rebased onto
  `main` after Phases B and C merged). One migration, `20261105210000_feeds_calendar_reminders.sql`,
  with five tenant tables (`feed_items`, `calendar_tokens`, `reminder_preferences`, `reminder_log`,
  `contacts`), each with row-level security; `tests/rls/feeds.test.ts` plus the isolation matrix.
  One fresh-context review round: five Important findings, four fixed in E-05, one kept on purpose
  (the "Award" link on the grant record points at Phase G's page, which that phase adds; the link
  was requested so the two phases meet). Verified by: `pnpm typecheck`, `pnpm lint`,
  `pnpm format:check`, `pnpm build`; `vitest run tests/db tests/rls` (346 tests, allowed for a
  migration); the iCal and RSS readers, iCal writer, time-zone math, private-address checks and
  reminder schedule run once by hand against the real DOE hub feed files. Not done: no page was
  loaded in a browser (no `.env.local` here and the shared local Supabase stack belongs to another
  folder), no email was sent (no mail key). Tests: not run beyond the two suites above (weekly
  review policy).
  - **Human steps.** H-4: create the Resend key and set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel;
    until then the reminder run counts and skips, and the calendar page says so. Also set
    `CRON_SECRET` (any long random string) in Vercel. And add the cron entry to `vercel.json`
    (high tier, maintainer only):
    `"crons": [{ "path": "/api/cron/reminders", "schedule": "0 12 * * *" }]`
    (daily at 12:00 UTC). By hand:
    `curl -H "Authorization: Bearer $CRON_SECRET" https://<address>/api/cron/reminders`.
    After merge, apply the migration to the hosted Supabase project as for Phase B.
  - **DOE SBIR/STTR hub feeds**, both reachable on 2026-11-05: iCal
    `https://sbir-sttr.connectwerx.org/events/?ical=1` (three events; FY26 Fall pitch deadline
    Dec 16, 2026, 2:00 PM Atlantic as the feed states it) and RSS `https://sbir-sttr.connectwerx.org/feed/`
    (one placeholder post). Both are presets on the calendar page; any iCal or RSS address works.
  - **Shared files touched outside the brief**, each invited by a comment in the file:
    `components/shell/nav-items.ts` (Grants and Calendar links) and `lib/auth/routes.ts`
    (`APP_HOME_PATH` → `/grants`). `types/supabase.ts` regenerated from a scratch database
    (additive only).
