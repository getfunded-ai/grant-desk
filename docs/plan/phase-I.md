# Phase I: The US$1 tier

Milestone 2: Light version, public (target 2026-12-11) · Tier: **high** · Runs with: J · Depends on: C

## Goal

Someone can pay US$1 (once or monthly) and the webinar area unlocks.

## Owns (work only here)

- `lib/billing/**`
- `app/api/billing/**`
- `app/api/webhooks/**`
- `app/(app)/plan/**`
- `app/(app)/webinars/** (gate only)`
- `tests/billing/**`
- `supabase/migrations/*_entitlements_*.sql`

## Build

1. Through the Dollar App Store: list Grant Desk there; handle the launch code; call `POST /api/entitlements` server-side; store the entitlement with expiry; gate the webinar area.
2. For self-hosters, optionally: Stripe Checkout (US$1 once; US$1 monthly), Customer Portal, webhooks with signature check and idempotency, entitlements table.
3. Money tests either way (required by the testing policy).

## Done when

- A test purchase unlocks the webinar area; cancelling locks it at period end.
- Tests pass for the webhook or entitlement path.

## Human steps

- H-6: store activation or Stripe keys.

## Merge rule

Zach merges this pull request by hand after reading the CEO summary. The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins.

## Kickoff prompt (paste into a new Claude Code session in the repo)

```
You are working in the grant-desk repository on Phase I: The US$1 tier.
Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-I.md first. Work only in the
folders the brief owns. Create the branch phase/i-the-one-dollar-tier from main.
You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
"Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
Important finding, and write the "Independent review evidence" block. Open a pull request whose body
starts with the "CEO summary" block. Tier: high. Report status to the maintainer after each
task and ask your questions there. Update docs/PROGRESS.md after every task.
Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
deleting data.
```
