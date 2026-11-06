# Progress

Living status. Every agent updates its own phase row and its own session-log lines after every task.

## Phases

| Phase | Name                    | Status      | Pull request                       | Verified by                                                       |
| ----- | ----------------------- | ----------- | ---------------------------------- | ----------------------------------------------------------------- |
| A     | Repo and guardrails     | done        | merged before the repo went public | format, typecheck, lint, build; three fresh-context review rounds |
| B     | Data model and security | in review   | #28                                | db reset, advisors, typecheck, lint, build; 262 tests             |
| C     | Login, shell, deploy    | in review   | #29                                | typecheck, lint, format, two builds; 66 sign-in tests             |
| D     | Grants.gov sync, browse | in review   | (link added when opened)           | PGlite migration and RLS tests; full extract loaded locally; typecheck, lint, build |
| E–Z   | see ROADMAP.md          | not started |                                    |                                                                   |

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
- 2026-11-05: Phase D built the Grants.gov catalog. One migration adds agencies, Assistance Listings,
  opportunity details, a sync-run log, full-text search, a server-only batch upsert, and a trigger
  that writes an activity_log line for every tracked grant when its opportunity's status or close
  date changes. The nightly job streams the 320 MB daily extract without holding it in memory and
  keeps about 2,200 of the 84,000 records (forecasts, open, closed within a year, plus anything
  already tracked). The intraday job fetches new postings and every tracked opportunity's packages
  and attachments. Browse page with filters, detail page, and "Track this" (creates a grant in stage
  prospect). Verified by: PGlite migration and RLS tests (all green), the real 2026-11-05 extract
  loaded into a throwaway Postgres through the real loader (83,671 scanned, 2,218 loaded, rerun
  reported 2,218 unchanged), the intraday job run once against the live API, `pnpm typecheck`,
  `pnpm lint`, `pnpm format:check`, `pnpm build`. Not loaded in a browser: no database has the
  migration until it merges. Tests: only the migration/RLS exception tests were run (weekly review
  policy). Maintainer steps: set `CRON_SECRET` in Vercel; add two cron lines to `vercel.json`
  (high tier): `{ "path": "/api/cron/grants-gov/nightly", "schedule": "30 10 * * *" }` and
  `{ "path": "/api/cron/grants-gov/intraday", "schedule": "0 13,17,21 * * *" }`; after
  `supabase db push`, call the nightly route once by hand.
