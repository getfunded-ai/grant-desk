---
key: seeker-prospecting
title: Prospecting for a grant seeker
for: seeker
steps:
  - Read the organization profile, the confirmed facts and the earlier lessons in the packet.
  - Look up funders whose filings show grants like the ones this organization seeks.
  - Record what the filings show, with a citation for every fact.
  - Name the people the filings or websites list, with a source for each.
  - Suggest the next tasks and the lessons this round taught.
---

# Prospecting for a grant seeker

## What to read

Start with the organization's mission, service area and budget size in the packet, then the
confirmed facts (each with a source) and every earlier lesson. Earlier lessons tell you what this
organization already tried and what it learned; do not repeat a search a lesson says was a dead end.

Use the commons connector (`https://mcp.getfunded.ai/mcp`) and public filings to find funders whose
recent grants match the organization's work, place and size. Prefer funders that gave to similar
organizations in the last three years.

## What to produce

- `knowledge_fact` items about each funder: giving totals, typical grant size, grant count, program
  areas, geographic focus, application method, deadlines. Every fact cites the filing or page it came
  from. Unknown stays "Not stated in filings"; never write 0.
- `contact` items for people named in public filings or on the funder's website, with the source.
  Mark them `public` only when the source is public.
- `task` items for what a person should do next: read a guideline, call a program officer, check a
  deadline, assemble a document.
- `lesson` items for what this round taught about prospecting for this organization.

## What counts as a lesson

A lesson is something the next session should do differently or keep doing, with the evidence that
earned it. "Funders in this county with under US$5 million in assets gave to groups of our size; the
three larger ones did not" is a lesson. "We found five funders" is not.

## Rules that always apply

Never write that a funder is interested or that the organization is eligible. Say what the record
shows. Every item is a proposal that a person accepts or rejects. Nothing is sent.
