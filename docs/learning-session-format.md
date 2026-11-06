# Learning session format, version 1

A learning session is one round of work for one organization: what it knows, what it tries, what
happens, what it learns. Grant Desk exports a **packet** at the start and imports a **results** file
at the end. An AI assistant (Claude Code with the `nonprofit-grants` plugin, or any other) reads the
packet and writes the results. The app turns every result item into a proposal that a person accepts
or rejects. The app never sends a message and never moves a stage by itself.

This file is the contract between Grant Desk (Phase AA) and the `learning-session` skill in
`getfunded-ai/open-nonprofit-platform`. Change it only by raising `schema_version`.

## 1. The packet (Markdown with one JSON block)

The packet is a Markdown file a person can read and paste into any assistant. It ends with a fenced
` ```json ` block that holds the same content as data. The Markdown part is for people; the JSON part
is what tools read.

```json
{
  "schema_version": 1,
  "session": {
    "id": "uuid",
    "number": 1,
    "playbook": "seeker-prospecting",
    "goal": "text",
    "opened_at": "2026-11-06T02:00:00Z"
  },
  "organization": {
    "id": "uuid",
    "name": "text",
    "kind": "seeker | funder | company",
    "ein": "text or null",
    "uei": "text or null",
    "mission": "text or null",
    "budget_size": "text or null",
    "service_area": "text or null"
  },
  "knowledge": [
    {
      "id": "uuid",
      "subject_kind": "organization | funder | opportunity | contact | grant",
      "subject_id": "uuid or null",
      "fact": "text",
      "source_kind": "filing | website | document | person | ai",
      "source_ref": "URL, document id, or 'said by <role>'",
      "confidence": "stated | likely | guess",
      "confirmed_at": "ISO date"
    }
  ],
  "grants": [
    {
      "id": "uuid",
      "title": "text",
      "funder_name": "text or null",
      "stage": "prospect | qualifying | loi | application | submitted | awarded | declined | active | reporting | closed",
      "amount_asked": "number or null",
      "amount_awarded": "number or null",
      "next_deadline": "ISO date or null"
    }
  ],
  "deadlines": [
    { "grant_id": "uuid or null", "title": "text", "due_at": "ISO date", "kind": "text" }
  ],
  "contacts": [
    {
      "id": "uuid",
      "name": "text",
      "role": "text or null",
      "funder_id": "uuid or null",
      "last_touch_at": "ISO date or null",
      "last_touch_kind": "text or null"
    }
  ],
  "lessons": [
    {
      "session_number": 1,
      "applies_to": "prospecting | outreach | application | post_award | general",
      "lesson": "text",
      "evidence": "text"
    }
  ],
  "rules": [
    "Facts come only from the packet or from tools; cite each one.",
    "Unknown is not zero or closed: write 'Not available' or 'Not stated in filings'.",
    "Never say a funder is interested or an organization is eligible. Say what the record shows.",
    "Every item is a proposal. A person decides. Nothing is sent.",
    "Label the output as prepared with AI, with model and date."
  ]
}
```

Rules for the exporter:

- `knowledge` holds confirmed facts only (status `confirmed`), newest first.
- `lessons` holds every earlier session's lessons, newest session first. Session 1 has an empty list.
- `contacts` holds contacts touched in the last 90 days plus contacts linked to open grants. Private
  contact details (email, phone) are never in the packet.
- Amounts are numbers or `null`, never `0` for unknown.

## 2. The results (JSON)

```json
{
  "schema_version": 1,
  "session_id": "uuid",
  "produced_by": {
    "tool": "claude-code nonprofit-grants/learning-session",
    "model": "claude-fable-5-1",
    "date": "2026-11-06"
  },
  "summary": "Three to five plain sentences a person can read first.",
  "items": [
    {
      "kind": "knowledge_fact",
      "payload": {
        "subject_kind": "funder",
        "subject_ref": { "ein": "text or null", "name": "text" },
        "fact": "text",
        "source_kind": "filing",
        "source_ref": "URL or filing id",
        "confidence": "stated"
      },
      "evidence": [
        { "source_ref": "URL or filing id", "quote": "verbatim text, at most 300 characters" }
      ]
    },
    {
      "kind": "contact",
      "payload": {
        "name": "text",
        "role": "text or null",
        "funder_ref": { "ein": "text or null", "name": "text" },
        "publishability": "public",
        "source_ref": "URL"
      },
      "evidence": [{ "source_ref": "URL", "quote": "text" }]
    },
    {
      "kind": "outreach_draft",
      "payload": {
        "to_contact_name": "text",
        "channel": "email | letter | call_script",
        "subject": "text or null",
        "body": "text",
        "uses_facts": ["knowledge fact ids or source refs"]
      },
      "evidence": [{ "source_ref": "text", "quote": "text" }]
    },
    {
      "kind": "task",
      "payload": {
        "title": "text",
        "grant_ref": { "id": "uuid or null", "title": "text or null" },
        "due_at": "ISO date or null",
        "why": "text"
      },
      "evidence": []
    },
    {
      "kind": "stage_move",
      "payload": {
        "grant_ref": { "id": "uuid", "title": "text" },
        "from_stage": "prospect",
        "to_stage": "qualifying",
        "why": "text"
      },
      "evidence": [{ "source_ref": "text", "quote": "text" }]
    },
    {
      "kind": "lesson",
      "payload": { "applies_to": "prospecting", "lesson": "text", "evidence": "text" },
      "evidence": []
    }
  ]
}
```

Rules for the importer (Grant Desk):

- Reject the file if `schema_version` is not 1, `session_id` does not match the open session, or
  `produced_by.model` or `produced_by.date` is missing.
- Reject any `knowledge_fact`, `contact`, `outreach_draft` or `stage_move` item whose `evidence` is
  empty. `task` and `lesson` items may have empty evidence.
- Reject any payload text that contains the words "is interested", "is eligible" or "will fund"
  about a funder or organization. Case does not matter.
- Every accepted item becomes one `proposals` row with `source = 'ai'`, the model and date from
  `produced_by`, and the whole item as the payload. Accepting a proposal writes the record; rejecting
  it writes nothing. A `stage_move` is accepted on the grant record page (Phase E), not here.
- A `lesson` item accepted at close time becomes a `session_lessons` row.

Rules for the producer (the skill):

- Use only the packet and the commons connector tools (`https://mcp.getfunded.ai/mcp`) or other
  public sources the person names. Cite each fact. Quote at most 300 characters per evidence entry.
- Follow the playbook named in `session.playbook`. Produce at most 25 items.
- Put the lessons you suggest as `lesson` items, not in the summary.
- Say in `summary` that the output was prepared with AI and must be checked by a person.

## 3. Playbook keys

| Key                       | For             | Produces                                                           |
| ------------------------- | --------------- | ------------------------------------------------------------------ |
| `seeker-prospecting`      | seeker          | funder facts, contacts, tasks, lessons                             |
| `seeker-outreach`         | seeker          | outreach drafts, tasks, lessons                                    |
| `application-prep`        | seeker, company | tasks, knowledge facts about the opportunity, lessons              |
| `post-award-reporting`    | seeker, company | tasks for reports due, knowledge facts about award terms, lessons  |
| `funder-grantee-outreach` | funder          | facts about candidate grantees, contacts, outreach drafts, lessons |
| `company-nondilutive`     | company         | federal and state opportunity facts, tasks, lessons                |

The playbook text lives in `content/playbooks/<key>.md` in Grant Desk and is copied into the packet's
Markdown part so the producer does not need the repository.
