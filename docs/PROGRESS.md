# Progress

Living status. Every agent updates its own phase row and its own session-log lines after every task.

## Phases

| Phase | Name                    | Status      | Pull request                       | Verified by                                                       |
| ----- | ----------------------- | ----------- | ---------------------------------- | ----------------------------------------------------------------- |
| A     | Repo and guardrails     | done        | merged before the repo went public | format, typecheck, lint, build; three fresh-context review rounds |
| B     | Data model and security | in review   | #28                                | db reset, advisors, typecheck, lint, build; 262 tests             |
| C     | Login, shell, deploy    | done        | #29 (merged 2026-11-06)            | typecheck, lint, format, two builds; 66 sign-in tests             |
| G     | Post-award, compliance  | in review   | #32                                | PGlite migration and RLS tests (432), typecheck, lint, build      |
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
