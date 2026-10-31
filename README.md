# Grant Desk (working name)

Open-source grant management for nonprofit grant seekers. Find, track, win and report on grants from
foundations, companies, cities, counties, states and the federal government. Free to use on the web.
Open source so anyone can run it. A US$1 tier adds a monthly training webinar.

**Status:** Phase A of 26 is done (repo and guardrails). Phases B and C are in progress. Nothing is deployed yet.
See [ROADMAP.md](ROADMAP.md) for the phases and [docs/PROGRESS.md](docs/PROGRESS.md) for where the work is.

## Why

Grant managers track dozens of deadlines, documents, reports and funder contacts in spreadsheets or in
tools that cost US$300 to US$1,000 a month, hide post-award features in the top tier, and sometimes shut
down (GrantHub closed on 31 January 2026). Grant Desk is the open alternative: free tier that includes
post-award, unlimited users, many organizations per login, a live Grants.gov feed, open funder data,
full export on every tier, and a consultant view across clients.

## Start here

| If you want to                  | Read                                         |
| ------------------------------- | -------------------------------------------- |
| Run a phase with a coding agent | `AGENTS.md`, then your brief in `docs/plan/` |
| See every phase, A to Z         | [ROADMAP.md](ROADMAP.md)                     |
| See where the agents are        | [docs/PROGRESS.md](docs/PROGRESS.md)         |
| Read the research               | [docs/research/](docs/research/)             |
| Read the decisions              | [docs/decisions/](docs/decisions/)           |

## Run locally

Node 22 or later and pnpm 12.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. Until Phases B and C land, there is no database and no sign-in.

```sh
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm build       # next build
```

## Layout (when Phase A is done)

```
app/            Next.js App Router pages and route handlers
components/     UI components (shadcn/ui)
lib/            server and shared code, one folder per concern
supabase/       migrations, seed, local config (from Phase B)
tests/          only the tests the testing policy allows (auth, billing, RLS, migrations, deletion)
tools/          the risk-tier and review-gate scripts the workflows run
docs/           plan, phase briefs, human checklist, progress, decisions, research
.github/        risk tiers, workflows, pull request and issue templates
```

## How work is reviewed and merged

Every pull request is labelled low, medium or high by `.github/risk-tiers.yml`. Low and medium merge
themselves when the checks and the review gate pass. High waits for Zach. The review happens inside the
authoring agent's own session, in a fresh context; no paid review bot is used. See `AGENTS.md`.

## Licence

Code: [MIT](LICENSE). Data the app stores belongs to the organization that entered it.
