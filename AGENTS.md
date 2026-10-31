# Agent rules for grant-desk

Read this file, then `REVIEW.md`, then `ROADMAP.md`, then your phase brief in `docs/plan/`. Zach is not a developer; write every handoff,
pull request and dispatch in plain words.

## What this repository is

Grant Desk (working name) is an open-source web app for nonprofit grant seekers: find, track, win and
report on grants from foundations, companies, cities, counties, states and the federal government.
Version 1 serves one organization. Version 2 adds a consultant view across many client organizations.
Next.js on Vercel, its own Supabase project, MIT.

It is part of the GetFunded family of open tools (https://getfunded.ai) and a separate product from the
hosted funder search. It reads foundation data from the public commons connector at
`https://mcp.getfunded.ai/mcp`. It never writes to the funder database behind that connector, and no
tenant table of this app goes there (ADR-0001).

## Where work happens

- One phase = one GitHub issue = one branch `phase/<letter>-<slug>` = one pull request into `main`.
- Work only in the folders your phase brief owns, plus the shared files listed below. Phases in the same "runs with" group run at the same
  time in separate sessions, so touching another phase's folders causes conflicts.
- Never push to `main`. Never force-push. Never merge your own pull request. Never change a tier label.
- Commit messages: `<phase-id>: <what changed>` in the imperative, for example `D-03: add the nightly
Grants.gov extract loader`.
- Update `docs/PROGRESS.md` after every task: status, branch, pull request link, the `Verified by` line,
  anything blocked.

## Shared files (every phase may edit these, and only these, outside its brief)

- `docs/PROGRESS.md`: only your phase's row and your own session-log lines.
- `ROADMAP.md`: only the Status cell of your phase's row.
- `package.json` and `pnpm-lock.yaml`: to add a dependency or a script your phase needs.

Two phases that run together may both touch these files. Rebase on `main` before you mark the pull
request ready, and keep the other phase's lines exactly as they are. Do not edit any other shared file.

## Testing policy (Zach's rule, 2026-10-08)

- Do not write or run test suites during a development cycle. Do not wait on or poll CI.
- Verify each change once with the cheapest direct check: `pnpm typecheck`, `pnpm lint`, `pnpm build`, or
  load the page once in the Vercel preview and say what you saw.
- Write the handoff line: `Verified by: <what you ran>. Tests: not run (weekly review policy).`
- Exceptions, where tests ARE written and run: database migrations, row-level security, sign-in,
  credentials, money, data deletion, and a bug that already escaped once. Those tests live under `tests/`
  and run in `pr-checks` only when their folders change. `weekly-tests.yml` runs everything once a week.

## Pull request review policy (Zach's rule, 2026-10-26)

The maintainer's review policy, in short:

1. Review inside your own session, in a fresh context (`/code-review` on the branch, or a fresh subagent
   with the diff). Give the reviewer `AGENTS.md` and `REVIEW.md`. Never use the Claude GitHub App reviewer,
   Cursor Bugbot, an API key, or any paid review service. Never add a workflow that calls a paid AI.
2. Fix every Important finding before the pull request is ready. Answer each Nit in one line. A
   Pre-existing bug gets its own issue. Stop after three rounds and report to Zach.
3. Put the "Independent review evidence" block in the pull request body with the exact head commit. A new
   commit makes it stale; review the new lines and update the block. Never write evidence for a review that
   did not run. A skipped review is written as "Not reviewed", with the reason.
4. Risk tiers come from `.github/risk-tiers.yml`, read from `main`. Low and medium pull requests merge
   themselves when `pr-checks`, `risk-tier` and `review-gate` pass. High waits for Zach.
5. Every pull request body starts with the "CEO summary" block. Plain words. At most one decision for Zach.

## Honesty rules (from getfunded, non-negotiable)

1. Unknown is not closed or zero: an absent fact reads "Not stated in filings" or "Not available".
2. Every fact from a filing carries its source. AI output is labelled with model and date, cites its
   evidence, and never claims a funder is interested or that an organization is eligible.
3. AI and agents never move a pipeline stage or edit a grant record directly. They insert a row in
   `proposals`; a person accepts or rejects it.
4. No fabricated data. No demo data in production. No real client or customer names in code,
   fixtures, docs or commits.
5. Percentages of an award are never computed for consultant pay (GPA and AFP ethics).

## Data rules

- Every tenant table has `organization_id` and a row-level-security policy. The browser never uses a
  service key. Server code uses the service key only inside checked server actions and route handlers.
- Opportunities use the CommonGrants shape (status, money, key dates, custom fields).
- Candid data is not used. FEC data is not used. Nothing behind a login is scraped.
- Local means local: `.env.local` is never read aloud or committed. Secrets go into Vercel by Zach.

## Stop and ask (dispatch to the command center, then move on)

- Any write to a production database by hand, any production deploy outside the normal pull request flow,
  DNS, payments going live, publishing the repo, or sending a message to a real person.
- Anything that needs a secret that is not already in the environment. Never print a secret.
- A change to `AGENTS.md`, `REVIEW.md`, `.github/**`, the tiers or the gate.
- The same check failing after three honest attempts.
- Deleting files or data.

## Status reports

After each task, when you wait, and when you stop, tell the maintainer what happened, what is pending,
and what you need, in plain words. Never put a credential in a status report, a question or a pull
request. Steps marked `H-<n>` in the phase briefs are the maintainer's own steps (accounts, money,
publishing); ask for them, do not do them.
