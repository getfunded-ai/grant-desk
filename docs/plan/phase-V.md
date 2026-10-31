# Phase V: Distribution automation

Milestone 5: Growth engine and operations (target 2027-03-26) · Tier: **high** · Runs with: U, W · Depends on: U

## Goal

Zero-touch distribution where the rules allow it, and launch kits where a human must click.

## Owns (work only here)

- `lib/distribution/**`
- `app/api/cron/distribution/**`
- `content/launch/**`
- `docs/launch/**`

## Build

1. RSS to email with Resend Broadcasts.
2. Bluesky and Mastodon posts from the digest, accounts labelled as bots.
3. LinkedIn Page posting after the app review (human step).
4. GitHub release notes on every tag.
5. Launch kits: Show HN text, Product Hunt listing, directory submission checklist. Zach clicks.

## Done when

- A digest post goes out to Bluesky and the newsletter once, from a test account.

## Human steps

- H-9: listings and launch posts.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase V: Distribution automation.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-V.md first. Work only in the
folders the brief owns. Create the branch phase/v-distribution-automation from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
