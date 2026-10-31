# ADR-0001: Grant Desk is its own open-source repository that uses the GetFunded open engine

Date: 2026-10-30 · Status: accepted by the maintainer on 2026-10-31.

## Context

GetFunded (https://getfunded.ai) maintains open funder data from public IRS filings and a free, read-only
commons connector at `https://mcp.getfunded.ai/mcp`. Grant seekers also need a place to run their grant
work: a pipeline, deadlines, documents, post-award reporting, and, for consultants, many client
organizations at once. Today that means spreadsheets or tools that cost hundreds of dollars a month.

## Decision

1. **Separate repository, separate product.** Grant Desk has its own repo and release pace.
2. **Whole app open source, MIT.** Anyone can run it. The hosted version is free, with a US$1 tier.
3. **Own Supabase project.** Tenant data (organizations, grants, documents, proposals) never goes into the
   funder database behind the commons connector.
4. **Reads the open engine, does not copy it.** Foundation facts come from the commons connector, with
   ProPublica Nonprofit Explorer as a fallback. Grants.gov data is loaded by this app's own nightly job, so
   self-hosters do not depend on the commons.
5. **Pipeline model.** Stages prospect, qualifying, loi, application, submitted, awarded, declined, active,
   reporting, closed. A `proposals` ledger: AI and agents propose, people decide.
6. **Multi-tenant from day one.** Every record belongs to an organization; a user may belong to many.
7. **Opportunities use the CommonGrants shape** (status, money, key dates, custom fields).
8. **Billing through the Dollar App Store**, so one store sells several US$1 tools and handles tax once.
   Self-hosters may wire Stripe directly.
9. **Reviews and merges** follow `AGENTS.md`: review in a fresh context, risk tiers, and a rule-based
   merge gate. No paid review bot.

## Consequences

The GetFunded family gains an open grant management app. getfunded.ai becomes the home for several
plug-and-play tools, and people can reach Grant Desk on the web or through an MCP plugin in their AI client.
