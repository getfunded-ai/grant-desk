# Roadmap: Phases A to Z

Each phase is one job for one coding agent in one session. The brief for each is in `docs/plan/`.
"Tier" sets who merges: low and medium merge themselves when the checks and the review gate pass; high
waits for Zach. Every phase that adds a database migration or a public page is high. The real tier of a
pull request comes from `.github/risk-tiers.yml`; this table is the expected result. Phases in the same "runs with" group can run at the same time in separate sessions.
Dates assume two to four sessions at once and answers from Zach within a day.

## Milestone 1: Foundation (target 2026-11-13). The maintainers track a real federal application in the live app.

| Phase | Name                          | Tier | Runs with | Status      |
| ----- | ----------------------------- | ---- | --------- | ----------- |
| A     | Repo and guardrails           | high | —         | in progress |
| B     | Data model and security       | high | C         | in review   |
| C     | Login, shell, deploy          | high | B         | done        |
| D     | Grants.gov sync and browse    | high | E         | in review   |
| E     | Pipeline, calendar, reminders | high | D         | in review   |

Gate: a maintainer signs in on the live site, creates an organization, adds a federal opportunity,
subscribes to an agency's iCal feed, and sees the deadline on their own calendar.

## Milestone 2: Light version, public (target 2026-12-11). A stranger can use it and pay US$1.

| Phase | Name                        | Tier   | Runs with | Status      |
| ----- | --------------------------- | ------ | --------- | ----------- |
| F     | Documents and boilerplate   | medium | G, H      | not started |
| G     | Post-award and compliance   | high   | F, H      | in review   |
| H     | Funder profiles             | medium | F, G      | not started |
| I     | The US$1 tier               | high   | J         | not started |
| J     | Public site, SEO, analytics | high   | I         | not started |
| AA    | Learning loops              | high   | D, E, G   | in review   |

Gate: the repo is public; the site is on its real address; a test card buys the US$1 plan; then live mode.

## Milestone 3: Full single-organization version (target 2027-01-22)

| Phase | Name                     | Tier   | Runs with | Status      |
| ----- | ------------------------ | ------ | --------- | ----------- |
| K     | AI help                  | medium | L, M      | not started |
| L     | Team                     | high   | K, M      | not started |
| M     | Import and export        | medium | K, L      | not started |
| N     | Government registrations | medium | O         | not started |
| O     | State and local sources  | medium | N         | not started |

## Milestone 4: Consultant version (target 2027-02-19). A working grant consultant runs two real clients in it.

| Phase | Name                          | Tier   | Runs with | Status      |
| ----- | ----------------------------- | ------ | --------- | ----------- |
| P     | Portfolio layer               | high   | —         | not started |
| Q     | Client requests and reporting | medium | R, S      | not started |
| R     | Time and billing hooks        | medium | Q, S      | not started |
| S     | Templates and hand-off        | high   | Q, R      | not started |
| T     | Consultant onboarding         | high   | —         | not started |

## Milestone 5: Growth engine and operations (target 2027-03-26)

| Phase | Name                          | Tier   | Runs with | Status      |
| ----- | ----------------------------- | ------ | --------- | ----------- |
| U     | Programmatic SEO at scale     | high   | V, W      | not started |
| V     | Distribution automation       | high   | U, W      | not started |
| W     | Self-host kit                 | medium | U, V      | not started |
| X     | Webinar tier                  | medium | Y         | not started |
| Y     | Security, privacy, operations | high   | X         | not started |
| Z     | Launch review                 | high   | —         | not started |

## Success scorecard

| #   | Event                                                                        | How we know                                                   |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| S1  | A nonprofit person finds the site on their own and clicks a free-use link    | analytics event with a search or referral source; no outreach |
| S2  | A stranger clones or stars the repo                                          | GitHub star or clone from someone we do not know              |
| S3  | A stranger signs up                                                          | sign-up event; no outreach                                    |
| S4  | A stranger pays US$1                                                         | a payment from someone we do not know                         |
| S5  | The maintainers run a real federal application through the app               | the record is complete and the maintainers say it helped      |
| S6  | A working grant consultant says it is meaningfully better than what they use | their quote, in writing                                       |

## Direction from Zach (2026-10-30)

getfunded.ai is the home for several plug-and-play tools. Grant Desk moves under that domain before the
public launch (Phase J). Users should reach it however they like: the website, or an MCP plugin in their
AI client. Phase W adds a Grant Desk MCP server (propose-only writes) next to the existing commons connector.

## After Z (roadmap v3, not scheduled)

Simpler.Grants.gov "Apply" when it leaves alpha; Google Calendar two-way sync; a CommonGrants server of
our own; Slack and Teams notifications; mobile.
