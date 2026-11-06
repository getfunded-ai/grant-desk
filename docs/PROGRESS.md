# Progress

Living status. Every agent updates its own phase row and its own session-log lines after every task.

## Phases

| Phase | Name                    | Status      | Pull request                       | Verified by                                                       |
| ----- | ----------------------- | ----------- | ---------------------------------- | ----------------------------------------------------------------- |
| A     | Repo and guardrails     | done        | merged before the repo went public | format, typecheck, lint, build; three fresh-context review rounds |
| B     | Data model and security | in review   | #28                                | db reset, advisors, typecheck, lint, build; 262 tests             |
| C     | Login, shell, deploy    | done        | #29 (merged 2026-11-06)            | typecheck, lint, format, two builds; 66 sign-in tests             |
| E     | Pipeline and calendar   | in review   | #31                                | typecheck, lint, format, build; 346 tests; feed readers by hand   |
| G     | Post-award, compliance  | in review   | #32                                | PGlite migration and RLS tests (432), typecheck, lint, build      |
| D–Z   | see ROADMAP.md          | not started |                                    |                                                                   |
| AA    | Learning loops          | in review   | #33                                | PGlite tests (447), PostgREST check, typecheck, lint, build       |

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
- 2026-11-05 (Phase G, post-award and compliance): branch `phase/g-post-award-and-compliance`, started from
  the Phase B and C integration branch and rebased onto `main` once both merged. One migration adds six tenant tables (awards, award_reports, budget_lines, budget_actuals,
  reimbursements, compliance_items) with row-level security, a `(organization_id, id)` key on deadlines,
  and a trigger that keeps one calendar deadline per report due. The federal rules from 2 CFR 200 live in
  `lib/compliance/rules.ts` with their sections. The award page sits at `/grants/[id]/award`; Phase E adds
  the link from the grant record. Verified by: `pnpm exec vitest run tests` (432 migration, RLS and
  sign-in tests pass in PGlite), the schedule generator, single-audit check, de minimis calculator and CSV
  parser run once by hand with the output read, `pnpm typecheck`, `pnpm lint`, `pnpm build`. The page was
  not loaded in a browser: the shared local Supabase stack belongs to another session tonight and was not
  reset, and there is no preview deploy for this branch yet. Tests: only the migration and RLS tests the
  policy allows were written and run. One fresh-context review round: one Important finding (the
  single-audit card showed an unknown total as US$0) and three nits, all fixed; one pre-existing gap
  (deadlines have no done state) filed as issue #30. Two more rounds on the fix commits found nothing
  Important. Pull request #32 is open against `main`, ready for review; Zach merges it (high tier).
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
  - **Shared file touched outside the brief**, invited by the comment in it:
    `components/shell/nav-items.ts` (Grants and Calendar links). Sign-in still lands on
    `/settings`: the first push changed `APP_HOME_PATH` to `/grants`, which broke a Phase C sign-in
    test, so E-09 reverted it; the board is one click away in the header. `types/supabase.ts`
    regenerated from a scratch database (additive only).
- 2026-11-05: Phase AA (learning loops) built in one session alongside D, E and G. One migration
  (`organizations.kind`, `knowledge_facts`, `contacts`, `touches`, `learning_sessions`,
  `session_lessons`, `session_proposals`, three database functions), six generic playbooks, the
  packet builder and results validator, and the `/learning`, `/knowledge` and `/contacts` pages.
  The "Done when" walk-through ran as a PGlite test against the real migration (session 1 → packet →
  three hand-written items → accept two, reject one → close with a lesson → session 2 holds the
  lesson), and the query module ran end to end against a throwaway PostgREST as a signed-in editor.
  Not loaded in a browser: the shared local Supabase stack belongs to the other sessions tonight and
  was not touched, so the pages were verified by `pnpm build` only. Three files outside the brief's
  folders, each needed by Phase B's own test design or the shell: `tests/rls/fixtures.ts` and
  `tests/rls/tenant-isolation.test.ts` (the migration test requires every new table to be listed
  there, which puts the six tables under the cross-organization write tests), and
  `components/shell/nav-items.ts` (its comment asks each phase to add its pages). `types/supabase.ts`
  was regenerated from a throwaway Postgres with all four migrations. `docs/learning-session-format.md`
  was not changed.
- 2026-11-05: Phase AA pull request #33 opened ready for review on branch `phase/aa-learning-loops-2`
  (the rebased history after Phases B and C merged; the first branch could not be force-pushed under
  the repository rule and holds only the kickoff commit). Fresh-context review at `55f072f`: no
  Important findings, three nits, two fixed in `ed59f02`, one answered in the pull request. Tier
  high: Zach merges, then H-AA-1 applies the migration to the hosted project. Verified by: typecheck,
  lint, build; 447 PGlite tests; PostgREST query check. Tests: run (migration and RLS exception).
- 2026-11-06 (Phase AA): merged `main` after Phases E and G landed. Phase E had created `public.contacts` (people on a grant or at a funder) with the same migration version as Phase AA's file, so the Phase AA migration was renamed to `20261106090000_learning_loops.sql` and now shares Phase E's table instead of creating its own: it drops the rule that a contact needs a grant or a funder, adds `publishability` (default private), adds the `(organization_id, id)` key that touches reference, and keeps Phase E's policies and triggers. Phase E's test for the dropped rule now asserts the new one. Test fixtures, the isolation test and the nav items were hand-merged; `types/supabase.ts` regenerated from all six migrations. Verified by: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`; `vitest run tests/db tests/rls` (554 pass on the combined schema). The reconciliation lines were reviewed in a fresh context from the roadmap session (see the pull request).
