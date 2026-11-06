# Progress

Living status. Every agent updates its own phase row and its own session-log lines after every task.

## Phases

| Phase | Name                    | Status      | Pull request                       | Verified by                                                       |
| ----- | ----------------------- | ----------- | ---------------------------------- | ----------------------------------------------------------------- |
| A     | Repo and guardrails     | done        | merged before the repo went public | format, typecheck, lint, build; three fresh-context review rounds |
| B     | Data model and security | in review   | #28                                | db reset, advisors, typecheck, lint, build; 262 tests             |
| C     | Login, shell, deploy    | done        | #29 (merged 2026-11-06)            | typecheck, lint, format, two builds; 66 sign-in tests             |
| D–Z   | see ROADMAP.md          | not started |                                    |                                                                   |
| AA    | Learning loops          | in review   | #33                               | PGlite tests (447), PostgREST check, typecheck, lint, build       |

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
