"""Generate docs/plan/phase-*.md from one table. Run: python3 scripts/gen_phases.py"""
from pathlib import Path
import textwrap

OUT = Path(__file__).resolve().parent.parent / "docs" / "plan"
M = {
 1: ("Milestone 1: Foundation", "2026-11-13"),
 2: ("Milestone 2: Light version, public", "2026-12-11"),
 3: ("Milestone 3: Full single-organization version", "2027-01-22"),
 4: ("Milestone 4: Consultant version", "2027-02-19"),
 5: ("Milestone 5: Growth engine and operations", "2027-03-26"),
}
P = [
 dict(id="A", slug="repo-and-guardrails", name="Repo and guardrails", m=1, tier="high", runs="—", deps="none",
  goal="Give every later phase a repo with rules, briefs, checks and a merge gate, so agents can work in parallel without Zach watching.",
  owns=["everything (bootstrap phase; later phases own their own folders)"],
  build=["Next.js 16 App Router, TypeScript strict, Tailwind 4, shadcn/ui base, ESLint, Prettier.",
         "AGENTS.md, CLAUDE.md, REVIEW.md, README.md, LICENSE (MIT).",
         "ROADMAP.md with Phases A–Z; docs/plan/phase-*.md briefs; docs/PROGRESS.md; docs/research/.",
         ".github/risk-tiers.yml; workflows pr-checks, risk-tier, review-gate, weekly-tests; tools/risk_tier.py and tools/review_gate.py.",
         "CODEOWNERS; pull request template with the CEO summary and evidence blocks; issue template for a phase.",
         "ADR-0001."],
  done=["`pnpm typecheck`, `pnpm lint` and `pnpm build` pass.", "Every file above exists and reads plainly.",
        "The repo exists on GitHub under the owner Zach chose (H-1), rulesets require pr-checks, risk-tier and review-gate, auto-merge is on.",
        "One GitHub issue per phase B–Z, each linking its brief."],
  human=["H-1: approve the repo owner; turn on auto-merge; approve the ruleset; set up status reporting.", "H-2: import the repo in Vercel."]),
 dict(id="B", slug="data-model-and-security", name="Data model and security", m=1, tier="high", runs="C", deps="A",
  goal="A Supabase project with every version-1 table, row-level security on all of them, and generated types.",
  owns=["supabase/** (config, migrations, seed)", "lib/db/**", "types/supabase.ts", "scripts/db/**", "tests/db/** and tests/rls/**"],
  build=["Create the Supabase project `grant-desk` (Zach confirms the cost prompt, H-3). Never touch the funder database behind the commons connector.",
         "Migrations: organizations, memberships, profiles, funders, opportunities (CommonGrants shape: status, funding money fields, key dates, custom_fields jsonb, source url, external ids), grants (pipeline item: organization_id, funder_id or opportunity_id, stage, title, amounts, dates), grant_stage_history, tasks, deadlines, documents, notes, boilerplate, proposals (ledger: tool_name, summary, payload, status proposed/accepted/rejected), activity_log, external_feeds.",
         "Stage check: prospect, qualifying, loi, application, submitted, awarded, declined, active, reporting, closed.",
         "RLS: every tenant table scoped by membership in organization_id; helper function `is_member(org_id)`; no anon access; service role only from server code.",
         "Seed script with one demo organization for local use only (never production).",
         "Generated TypeScript types; typed server client in lib/db.",
         "RLS and migration tests under tests/ (allowed by the testing policy)."],
  done=["Local Supabase starts; all migrations apply from empty.", "RLS tests prove a member of org A cannot read org B.", "`pnpm typecheck` passes with the generated types."],
  human=["H-3: confirm the Supabase project cost."]),
 dict(id="C", slug="login-shell-deploy", name="Login, shell, deploy", m=1, tier="high", runs="B", deps="A",
  goal="A person can sign in, create an organization, invite a teammate, and switch organizations, on a live Vercel URL.",
  owns=["app/(auth)/**", "app/(app)/layout.tsx and app/(app)/onboarding/**, app/(app)/settings/**", "components/shell/**", "lib/auth/**", "lib/supabase/** (browser and server clients)", "proxy.ts (route protection)", "vercel.json", "docs/DEPLOY.md"],
  build=["Supabase Auth with email magic link; Google later.", "Onboarding: create organization; invite one teammate by email.",
         "Organization switcher in the shell; navigation; settings; profile.", "Vercel project linked to the repo; preview deploy per PR; env var names documented in .env.example and docs/DEPLOY.md.",
         "Error tracking hook (Sentry or Vercel's) behind an env flag."],
  done=["Sign in by magic link on the Vercel preview works once (say what you saw).", "A second organization appears in the switcher.", "Build passes with no env vars set (public pages) and with them set (app)."],
  human=["H-2: import the repo in Vercel.", "H-4: Resend account and Supabase custom SMTP."]),
 dict(id="D", slug="grants-gov-sync-and-browse", name="Grants.gov sync and browse", m=1, tier="high", runs="E", deps="B, C",
  goal="Every Grants.gov opportunity, posted and forecast, in our database every night, browsable with filters, trackable with one click.",
  owns=["lib/grants-gov/**", "app/api/cron/grants-gov/**", "app/(app)/opportunities/**", "components/opportunities/**", "supabase/migrations/*_opportunities_*.sql (new files only)"],
  build=["Nightly Vercel Cron: download `GrantsDBExtractYYYYMMDDv2.zip` from the S3 URL, parse the XML, upsert into opportunities in CommonGrants shape; keep legacy numeric id and opportunity number.",
         "Intraday: `search2` with `dateRange` for changes; `fetchOpportunity` for details, attachments, package ids, workspace-compatible flag; store agency and Assistance Listing tables.",
         "Detect status and close-date changes; write activity_log rows for tracked grants.",
         "Browse page: filters for eligibility (codes 12 and 13 for nonprofits), agency, category, status, close date, award ceiling; search by keyword.",
         "Detail page: deep link to `https://www.grants.gov/search-results-detail/{id}`, package ids and dates, attachments list.",
         "\"Track this\" creates a grant in stage prospect.", "Honesty: null funding reads \"Not stated\"."],
  done=["A nightly run loads the extract into a local database and reports counts.", "The browse page shows posted and forecast opportunities with filters working once in the preview.", "Tracking an opportunity creates a grant."],
  human=["H-5: Simpler.Grants.gov API key (optional in this phase)."]),
 dict(id="E", slug="pipeline-calendar-reminders", name="Pipeline, calendar, reminders", m=1, tier="high", runs="D", deps="B, C",
  goal="The heart of the app: a board of grants by stage, a record page, a calendar, feeds in and out, and email reminders.",
  owns=["app/(app)/grants/**", "app/(app)/calendar/**", "app/api/ical/**", "app/api/cron/reminders/**", "lib/pipeline/**", "lib/calendar/**", "lib/email/**", "components/pipeline/**", "components/calendar/**", "supabase/migrations/*_feeds_*.sql"],
  build=["Board by stage with drag between stages; an SBIR preset (pitch → invited → full application → go/no-go) as stage labels on the same stages.",
         "Grant record: funder, amounts asked and awarded, key dates, contacts, notes, tasks, files list, timeline from activity_log, proposals list with accept/reject.",
         "Calendar of deadlines and tasks; iCal feed per organization (signed token URL).", "Subscribe to outside iCal and RSS feeds (external_feeds); first target: the DOE SBIR hub iCal and RSS.",
         "Resend reminders at 30, 14, 7 and 1 days on a cron; per-user digest setting."],
  done=["Create a grant, move it across stages, see the timeline update.", "Subscribe the DOE hub iCal; its dates appear on the calendar.", "The iCal feed opens in a calendar app once.", "A reminder email arrives on a test address once."],
  human=["H-4 must be done for email to send."]),
 dict(id="F", slug="documents-and-boilerplate", name="Documents and boilerplate", m=2, tier="medium", runs="G, H", deps="E",
  goal="Files per grant with versions, and a reusable answer library.",
  owns=["app/(app)/documents/**", "app/(app)/boilerplate/**", "lib/storage/**", "lib/boilerplate/**", "components/documents/**"],
  build=["Upload to Supabase Storage in a per-organization bucket path; versions; attach to grants; size and type limits.", "Boilerplate library: title, body, tags, last used; copy button; search.", "Honesty: boilerplate is the organization's text, never AI text unless labelled."],
  done=["Upload a file, replace it, see both versions.", "Copy a boilerplate answer into a grant note."], human=[]),
 dict(id="G", slug="post-award-and-compliance", name="Post-award and compliance", m=2, tier="high", runs="F, H", deps="E",
  goal="After the award: terms, reports due, budget versus actual, reimbursements, a federal compliance checklist, close-out.",
  owns=["app/(app)/grants/[id]/award/**", "lib/compliance/**", "lib/budget/**", "components/award/**", "supabase/migrations/*_awards_*.sql"],
  build=["Award terms: amount, period of performance, payment method, indirect method.", "Report schedule generator from 2 CFR 200: SF-425 and performance reports at 30 days (quarterly or semiannual), 90 days (annual), 120 days (final); record-retention end date three years after the final report; single-audit flag at US$1,000,000 federal spend; de minimis 15% calculator.",
         "Budget versus actual table with CSV import of actuals.", "Reimbursement tracker: invoices sent, paid, days outstanding.", "Compliance checklist template per award; close-out step."],
  done=["Enter an award; the report dates appear on the calendar.", "The single-audit flag turns on at US$1,000,000."], human=[]),
 dict(id="H", slug="funder-profiles", name="Funder profiles", m=2, tier="medium", runs="F, G", deps="B",
  goal="Foundation facts from the open funder database, with sources, and manual funders for corporate programs.",
  owns=["lib/commons/**", "lib/propublica/**", "app/(app)/funders/**", "components/funders/**"],
  build=["Server-side client for the commons connector at mcp.getfunded.ai (MCP over HTTP, no key); ProPublica Nonprofit Explorer as fallback.", "Funder page: 990 and 990-PF facts, giving history, source on every fact, \"Not stated in filings\" when silent.", "Saved searches; manual funder entry for corporate giving programs."],
  done=["Search a foundation by name or EIN; open its page; every number shows its source."], human=[]),
 dict(id="I", slug="the-one-dollar-tier", name="The US$1 tier", m=2, tier="high", runs="J", deps="C",
  goal="Someone can pay US$1 (once or monthly) and the webinar area unlocks.",
  owns=["lib/billing/**", "app/api/billing/**", "app/api/webhooks/**", "app/(app)/plan/**", "app/(app)/webinars/** (gate only)", "tests/billing/**", "supabase/migrations/*_entitlements_*.sql"],
  build=["Through the Dollar App Store: list Grant Desk there; handle the launch code; call `POST /api/entitlements` server-side; store the entitlement with expiry; gate the webinar area.",
         "For self-hosters, optionally: Stripe Checkout (US$1 once; US$1 monthly), Customer Portal, webhooks with signature check and idempotency, entitlements table.", "Money tests either way (required by the testing policy)."],
  done=["A test purchase unlocks the webinar area; cancelling locks it at period end.", "Tests pass for the webhook or entitlement path."],
  human=["H-6: store activation or Stripe keys."]),
 dict(id="J", slug="public-site-seo-analytics", name="Public site, SEO, analytics", m=2, tier="high", runs="I", deps="D",
  goal="A public website strangers can find, with the first programmatic pages and the events that prove the scorecard.",
  owns=["app/(marketing)/**", "content/**", "app/sitemap.ts", "app/robots.ts", "app/opengraph-image.tsx", "lib/analytics/**", "lib/seo/**", "app/grants/** (public programmatic pages)", "components/marketing/**"],
  build=["Landing, pricing, docs, open-source page with clone steps, blog (MDX).", "Sitemap, robots, Open Graph images, Search Console file.", "Analytics events: free_link_click, repo_link_click, sign_up, payment (S1–S4), with referrer.",
         "Programmatic pages from the opportunities table only (public data): /grants/agency/[code], /grants/deadlines/[year-month], /grants/category/[code], /grants/for/nonprofits.", "A \"moving from GrantHub or Instrumentl\" page."],
  done=["Lighthouse SEO score above 90 on the landing page once.", "The programmatic pages render from live data in the preview.", "Events show up in the analytics tool."],
  human=["H-7: domain and Search Console.", "H-8: accept ADR-0008; make the repo public."]),
 dict(id="K", slug="ai-help", name="AI help", m=3, tier="medium", runs="L, M", deps="F",
  goal="Labelled, cited, propose-only AI help: summarize a notice, draft from boilerplate, score fit.",
  owns=["lib/ai/**", "app/api/ai/**", "components/ai/**", "app/(app)/settings/ai/**"],
  build=["Anthropic API with claude-sonnet-5-5 default and claude-haiku-5-5 for cheap tasks; bring-your-own-key setting per organization.", "Summarize a funding notice (PDF or page) with citations to the source text.", "Draft a section from boilerplate; fit score against eligibility text.",
         "Every output is labelled with model and date, cites its evidence, never claims interest or eligibility, and every write is a row in proposals."],
  done=["Summarize a real notice; the summary shows its label and sources.", "A draft lands as a proposal that a person accepts."],
  human=["Question 9: the key."]),
 dict(id="L", slug="team", name="Team", m=3, tier="high", runs="K, M", deps="C",
  goal="Roles, invites, assignment, comments, and a digest, for teams of any size.",
  owns=["lib/permissions/**", "app/(app)/team/**", "components/team/**", "lib/notifications/**", "supabase/migrations/*_roles_*.sql", "tests/rls/**"],
  build=["Roles owner, admin, editor, viewer enforced in RLS and in server actions.", "Invites by email with expiry; task assignment; comments and @mentions; activity feed; digest settings.", "RLS tests for each role."],
  done=["A viewer cannot edit; an editor cannot invite; tests prove it."], human=[]),
 dict(id="M", slug="import-and-export", name="Import and export", m=3, tier="medium", runs="K, L", deps="E",
  goal="No lock-in: import from spreadsheets and from GrantHub or Instrumentl exports; export everything.",
  owns=["lib/import/**", "lib/export/**", "app/(app)/import/**", "app/api/export/**", "components/import/**"],
  build=["CSV import wizard with column mapping and a preview; presets for GrantHub, Instrumentl and a plain spreadsheet.", "CSV and Excel export of grants, tasks, funders; full JSON export of the organization."],
  done=["Import a 20-row CSV; the grants appear; export them back and the rows match."], human=[]),
 dict(id="N", slug="government-registrations", name="Government registrations", m=3, tier="medium", runs="O", deps="C",
  goal="UEI lookup, SAM.gov expiry warnings, federal award history, SBIR feeds, and a per-agency submission-system field.",
  owns=["lib/sam-gov/**", "lib/usaspending/**", "lib/sbir/**", "app/(app)/settings/organization/**", "app/api/cron/registrations/**"],
  build=["SAM.gov Entity API: look up by legal name or UEI; store registration status and expiry; warn 60 and 30 days before expiry; cache hard because a plain key allows 10 calls a day; let users type their UEI.",
         "Assistance Listings API to enrich ALN codes on opportunities.", "USAspending: award history by UEI or name.", "SBIR.gov feed when its API returns (403 on 2026-10-30); until then the DOE hub RSS and iCal.",
         "Submission-system field on an opportunity: Grants.gov Workspace, NIH ASSIST, NSF Research.gov, DOE AMP."],
  done=["Enter a real organization's UEI; status and expiry appear; award history lists."],
  human=["H-5: SAM.gov key."]),
 dict(id="O", slug="state-and-local-sources", name="State and local sources", m=3, tier="medium", runs="N", deps="D",
  goal="State, county and city grants without a scraper: one real feed, a URL helper, and email parsing.",
  owns=["lib/sources/**", "app/api/cron/sources/**", "app/(app)/sources/**", "app/api/inbound-email/**"],
  build=["California Grants Portal CKAN feed, daily, into opportunities with source and custom fields.", "\"Import from URL\" helper: paste a page link; extract title, deadline, funder; confirm; save.", "Inbound email address per organization to turn a Grants.gov daily email or a state digest into opportunities (parse, never auto-track).", "Links to Submittable Discover and state portals."],
  done=["California opportunities appear after a run.", "Paste a URL; an opportunity is created after confirmation."], human=[]),
 dict(id="P", slug="portfolio-layer", name="Portfolio layer", m=4, tier="high", runs="—", deps="L",
  goal="A consultant sees every client in one place: one calendar, one dashboard, a one-click switcher.",
  owns=["app/(portfolio)/**", "lib/portfolio/**", "components/portfolio/**", "supabase/migrations/*_portfolio_*.sql", "tests/rls/portfolio.*"],
  build=["Portfolio view across the organizations a user belongs to; cross-client calendar; dashboard with workload by client; client tags.", "Switcher always one click away; the current organization is always visible.", "RLS tests: a consultant sees only organizations they belong to; a client staff user sees only their own."],
  done=["Two organizations, one calendar; switching takes one click; tests pass."], human=[]),
 dict(id="Q", slug="client-requests-and-reporting", name="Client requests and reporting", m=4, tier="medium", runs="R, S", deps="P",
  goal="Ask clients for what you need with due dates, and show them where things stand.",
  owns=["app/(app)/requests/**", "app/(client)/**", "lib/requests/**", "lib/reports/**", "components/requests/**"],
  build=["Input requests: ask a client for a document or an answer, with a due date and automatic nudges; the client answers from an emailed link.", "Monthly status report per organization as a link and a PDF.", "Read-only client login (viewer role) and an \"approve before we submit\" step on a grant."],
  done=["Send a request; answer it from the link; the file lands on the grant.", "Open the status report link as the client."], human=[]),
 dict(id="R", slug="time-and-billing-hooks", name="Time and billing hooks", m=4, tier="medium", runs="Q, S", deps="P",
  goal="Time per grant and client, retainers, and an invoice-ready export. Never a percentage of an award.",
  owns=["lib/time/**", "app/(app)/time/**", "components/time/**"],
  build=["Time entries per grant and client with a timer and manual entry.", "Retainer tracking (hours included, used, remaining).", "Invoice-ready CSV: hourly, flat fee, retainer; no percentage field anywhere (GPA and AFP ethics)."],
  done=["Log time on two clients; export a CSV grouped by client."], human=[]),
 dict(id="S", slug="templates-and-hand-off", name="Templates and hand-off", m=4, tier="high", runs="Q, R", deps="P",
  goal="Consultant templates kept apart from client data, and a clean hand-off when an engagement ends.",
  owns=["lib/templates/**", "lib/transfer/**", "app/(app)/settings/transfer/**", "tests/transfer/**"],
  build=["Consultant-owned boilerplate library separate from any client organization; copy into a client with a record of where it came from.", "Report branding (logo, name) per consultant.", "Transfer an organization to the client: ownership moves, the consultant's membership ends, everything stays; tests prove no data crosses organizations."],
  done=["Transfer a test organization; the consultant loses access; the client keeps everything."], human=[]),
 dict(id="T", slug="consultant-onboarding", name="Consultant onboarding", m=4, tier="high", runs="—", deps="Q, R, S",
  goal="A consultant finds the consultant path, signs up, and brings clients over.",
  owns=["app/(marketing)/consultants/**", "content/guides/**", "app/(app)/onboarding/consultant/**"],
  build=["Consultant sign-up path and pricing copy.", "Migration guides from Instrumentl's consultant plan, GrantHub Pro and Grantable.", "Design-partner feedback form that lands in the command center as a dispatch."],
  done=["A working grant consultant follows the guide and has two clients in the app (gate M4)."],
  human=["H-13: invite a design-partner consultant."]),
 dict(id="U", slug="programmatic-seo-at-scale", name="Programmatic SEO at scale", m=5, tier="high", runs="V, W", deps="J",
  goal="Thousands of useful public pages built from live data, refreshed nightly, plus a weekly digest nobody has to write.",
  owns=["app/grants/** (extend)", "app/funders/** (public)", "lib/seo/**", "content/digests/**", "app/api/cron/digest/**"],
  build=["State × cause \"deadlines this month\" pages; agency, category and funder pages; \"closing this week\".", "Sitemap index; canonical tags; no tenant data on any public page.", "Weekly digest written from live data by a cron and published to the blog and RSS."],
  done=["Pages render for every state and category; the sitemap lists them; the digest publishes once."], human=[]),
 dict(id="V", slug="distribution-automation", name="Distribution automation", m=5, tier="high", runs="U, W", deps="U",
  goal="Zero-touch distribution where the rules allow it, and launch kits where a human must click.",
  owns=["lib/distribution/**", "app/api/cron/distribution/**", "content/launch/**", "docs/launch/**"],
  build=["RSS to email with Resend Broadcasts.", "Bluesky and Mastodon posts from the digest, accounts labelled as bots.", "LinkedIn Page posting after the app review (human step).", "GitHub release notes on every tag.", "Launch kits: Show HN text, Product Hunt listing, directory submission checklist. Zach clicks."],
  done=["A digest post goes out to Bluesky and the newsletter once, from a test account."],
  human=["H-9: listings and launch posts."]),
 dict(id="W", slug="self-host-kit", name="Self-host kit", m=5, tier="medium", runs="U, V", deps="C",
  goal="Anyone can run Grant Desk themselves in under an hour.",
  owns=["docs/self-host/**", "docker-compose.yml", "Dockerfile", "scripts/setup/**", "README (deploy section)"],
  build=["\"Deploy to Vercel\" button; Supabase setup script that applies migrations and seeds; Docker Compose option; plain-words docs.", "Clone and star tracking on the open-source page (S2)."],
  done=["A fresh machine follows the docs and reaches the sign-in page."], human=[]),
 dict(id="X", slug="webinar-tier", name="Webinar tier", m=5, tier="medium", runs="Y", deps="I",
  goal="The US$1 benefit: a members area with the live link, invites and recordings.",
  owns=["app/(app)/webinars/**", "lib/webinars/**", "components/webinars/**"],
  build=["Members area gated by entitlement; next webinar with calendar invite; recording library; the Zoom or Meet link from settings."],
  done=["A paid test user sees the link; a free user sees the pitch."],
  human=["H-10: the recurring webinar link."]),
 dict(id="Y", slug="security-privacy-operations", name="Security, privacy, operations", m=5, tier="high", runs="X", deps="L",
  goal="Ready for strangers: audited security, deletion flows, legal pages, accessibility, backups.",
  owns=["lib/deletion/**", "app/(app)/settings/delete/**", "tests/deletion/**", "docs/policies/**", "app/(marketing)/legal/**", "lib/rate-limit/**"],
  build=["RLS audit across every table; rate limits on public and AI routes; backups verified; Supabase advisor fixes.", "Account and organization deletion with a grace period and tests.", "Terms and Privacy pages from counsel-approved drafts; a plain-words data retention policy.", "Accessibility pass to WCAG 2.2 AA on the main flows."],
  done=["Deletion tests pass; advisors show no high findings; legal pages live."],
  human=["H-11: counsel approves the drafts."]),
 dict(id="Z", slug="launch-review", name="Launch review", m=5, tier="high", runs="—", deps="all",
  goal="Measure the scorecard, write the retro, and set roadmap v3.",
  owns=["app/(app)/admin/scorecard/**", "docs/launch/REVIEW.md", "ROADMAP.md (v3 section)"],
  build=["Owner-only scorecard page for S1–S6 from analytics, GitHub and billing.", "Retro: what worked, what did not, what the users said.", "Roadmap v3: Simpler Apply when it leaves alpha, Google Calendar two-way sync, a CommonGrants server, mobile."],
  done=["Zach reads the scorecard and the retro and decides what is next."], human=["H-13: the scorecard gates."]),
]

def brief(p):
    mname, mdate = M[p["m"]]
    lines = [f"# Phase {p['id']}: {p['name']}", "",
             f"{mname} (target {mdate}) · Tier: **{p['tier']}** · Runs with: {p['runs']} · Depends on: {p['deps']}", "",
             "## Goal", "", p["goal"], "",
             "## Owns (work only here)", ""]
    lines += [f"- `{o}`" if not o.startswith("everything") else f"- {o}" for o in p["owns"]]
    lines += ["", "## Build", ""] + [f"{i+1}. {b}" for i, b in enumerate(p["build"])]
    lines += ["", "## Done when", ""] + [f"- {d}" for d in p["done"]]
    lines += ["", "## Human steps", ""] + ([f"- {h}" for h in p["human"]] or ["- None."])
    merge = ("Zach merges this pull request by hand after reading the CEO summary." if p["tier"] == "high" else
             "This pull request merges itself once `pr-checks`, `risk-tier` and `review-gate` are green."
             + (" Medium tier: run the self-review at high effort." if p["tier"] == "medium" else ""))
    merge += " The tier is set by `.github/risk-tiers.yml` from the files the pull request touches; if it differs from this brief, the file wins."
    lines += ["", "## Merge rule", "", merge, ""]
    kick = textwrap.dedent(f"""
    ## Kickoff prompt (paste into a new Claude Code session in the repo)

    ```
    You are working in the grant-desk repository on Phase {p['id']}: {p['name']}.
    Read AGENTS.md, REVIEW.md, ROADMAP.md and docs/plan/phase-{p['id']}.md first. Work only in the
    folders the brief owns. Create the branch phase/{p['id'].lower()}-{p['slug']} from main.
    You may also edit the shared files AGENTS.md lists (your own row in docs/PROGRESS.md and
    ROADMAP.md, package.json and pnpm-lock.yaml for dependencies). Build what the brief lists, in order. Verify once with the cheapest direct check and write the
    "Verified by" line. Then run /code-review in a fresh context with AGENTS.md and REVIEW.md, fix every
    Important finding, and write the "Independent review evidence" block. Open a pull request whose body
    starts with the "CEO summary" block. Tier: {p['tier']}. Report status to the maintainer after each
    task and ask your questions there. Update docs/PROGRESS.md after every task.
    Stop and ask before anything that touches production, money, secrets, DNS, sending messages or
    deleting data.
    ```
    """).strip("\n")
    lines += [kick, ""]
    return "\n".join(lines)

for p in P:
    (OUT / f"phase-{p['id']}.md").write_text(brief(p))
print(f"wrote {len(P)} briefs")
