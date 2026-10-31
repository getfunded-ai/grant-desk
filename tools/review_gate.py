#!/usr/bin/env python3
"""Publish the "review-gate" check from the pull request's review evidence.

Called by .github/workflows/review-gate.yml. Standard library only; GitHub is
reached through the ``gh`` CLI (GH_TOKEN must be set).

    python3 tools/review_gate.py --repo OWNER/NAME --pr 12 --head-sha SHA

The pull request body must hold two blocks (see .github/pull_request_template.md):

    ## CEO summary
    ...
    ## Independent review evidence
    Head: <full commit SHA that was reviewed>
    Base: <full commit SHA of the base branch>
    Reviewer: <tool and session, for example "Claude Code /code-review, fresh context">
    Findings: <n> Important (all fixed), <n> Nit (answered), <n> Pre-existing (tracked in #...)
    Verified by: <what you ran>. Tests: not run (weekly review policy).

HTML comments are removed first, so template guidance never counts. The gate passes
when: the CEO summary's five answer lines are filled in; the evidence block exists;
its Head names the pull request's current head commit; Reviewer and Findings do not
say "Not reviewed"; Findings shows "0 Important" or "<n> Important (all fixed)"; and
Reviewer and Verified by lines are present. A draft pull request gets an in-progress gate.
Anything else fails the gate with a plain-words reason. Never makes a check pass
by hand; never calls an AI service.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

CHECK_NAME = "review-gate"


def gh_api(path: str, method: str = "GET", body: dict | None = None) -> dict:
    command = ["gh", "api", "-X", method, path]
    stdin = None
    if body is not None:
        command += ["--input", "-"]
        stdin = json.dumps(body)
    completed = subprocess.run(command, input=stdin, text=True, capture_output=True)
    if completed.returncode != 0:
        sys.stderr.write(completed.stderr)
        raise SystemExit(f"gh api {method} {path} failed with exit code {completed.returncode}")
    return json.loads(completed.stdout) if completed.stdout.strip() else {}


def find_gate(repo: str, head_sha: str) -> dict | None:
    response = gh_api(f"repos/{repo}/commits/{head_sha}/check-runs?check_name={CHECK_NAME}&per_page=100")
    runs = [run for run in response.get("check_runs", []) if run.get("name") == CHECK_NAME]
    runs.sort(key=lambda run: run.get("id", 0), reverse=True)
    return runs[0] if runs else None


def publish(repo: str, head_sha: str, *, status: str, title: str, summary: str,
            conclusion: str | None = None) -> None:
    body = {"name": CHECK_NAME, "head_sha": head_sha, "status": status,
            "output": {"title": title, "summary": summary}}
    if conclusion:
        body["conclusion"] = conclusion
    existing = find_gate(repo, head_sha)
    if existing:
        gh_api(f"repos/{repo}/check-runs/{existing['id']}", "PATCH", body)
    else:
        gh_api(f"repos/{repo}/check-runs", "POST", body)
    print(f"{CHECK_NAME} on {head_sha[:10]}: {status} {conclusion or ''} - {title}")


COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
CEO_FIELDS = (
    "What changes for users or the business",
    "Why it helps",
    "Main downside or risk",
    "Recommendation",
    "Decision needed from Zach",
)


def strip_comments(text: str) -> str:
    """Remove HTML comments so template guidance never counts as an answer."""
    return COMMENT.sub("", text or "")


def section(body: str, heading: str) -> str | None:
    """The text under a '## <heading>' line, up to the next '##' heading."""
    pattern = re.compile(r"^#{2,3}\s*\**" + re.escape(heading) + r"\**\s*$", re.IGNORECASE | re.MULTILINE)
    match = pattern.search(body)
    if not match:
        return None
    rest = body[match.end():]
    nxt = re.search(r"^#{2,3}\s", rest, re.MULTILINE)
    return rest[: nxt.start()] if nxt else rest


def field(block: str, name: str) -> str | None:
    """The value after '<name>:' on its own line (bullets and bold allowed), or None if empty."""
    # [ \t] instead of \s: an empty field must never borrow the next line's text.
    match = re.search(r"^[ \t]*(?:[-*][ \t]*)?\**" + re.escape(name) + r"\**[ \t]*:[ \t]*(.*?)[ \t]*$",
                      block, re.IGNORECASE | re.MULTILINE)
    if not match:
        return None
    value = match.group(1).strip().strip("*").strip()
    return value or None


def head_of(value: str | None) -> str | None:
    """The first run of 7 to 40 hex characters in the Head line, ignoring any note after it."""
    if not value:
        return None
    match = re.search(r"\b[0-9a-fA-F]{7,40}\b", value)
    return match.group(0).lower() if match else None


def important_open(findings: str) -> str | None:
    """None when no Important finding is open; otherwise the reason.

    Every "<n> Important" on the line is checked, not only the first. Each must be
    "0 Important" or "<n> Important (all fixed)" with that exact parenthesis right
    after the word. "(not all fixed)", a later round's open count, or any other
    wording fails.
    """
    matches = re.findall(r"(\d+)\s+Important\b(\s*\(all fixed\))?", findings, re.IGNORECASE)
    if not matches:
        return "The Findings line does not say how many Important findings there were."
    open_counts = [int(n) for n, fixed in matches if int(n) > 0 and not fixed]
    if open_counts:
        return (f"{sum(open_counts)} Important finding(s) are not marked \"(all fixed)\". "
                "Fix them, then update the block.")
    return None


def verified_by(value: str | None) -> str | None:
    """The Verified by value, or None when it is empty or only the template's tail."""
    if not value:
        return None
    if value.startswith(".") or re.fullmatch(r"\.?\s*Tests:.*", value, re.IGNORECASE):
        return None
    return value


def evaluate(body: str, head_sha: str) -> tuple[bool, str, str]:
    """(passed, title, summary)."""
    body = strip_comments(body)
    problems: list[str] = []
    ceo = section(body, "CEO summary")
    if ceo is None:
        problems.append("The pull request body has no \"CEO summary\" block. Zach decides from that block.")
    else:
        empty = [name for name in CEO_FIELDS if field(ceo, name) is None]
        if empty:
            problems.append("The CEO summary is not filled in: " + ", ".join(empty) + ".")
    evidence = section(body, "Independent review evidence")
    if evidence is None:
        problems.append("The pull request body has no \"Independent review evidence\" block.")
        return False, "No review evidence", "\n".join(f"- {p}" for p in problems)
    reviewer = field(evidence, "Reviewer")
    findings = field(evidence, "Findings")
    if any(v and re.search(r"\bnot reviewed\b", v, re.IGNORECASE) for v in (reviewer, findings)):
        problems.append("The evidence says \"Not reviewed\". Run the review in a fresh context, fix the findings, and update the block.")
    head = head_of(field(evidence, "Head"))
    if head is None:
        problems.append("The evidence has no Head commit (7 to 40 hex characters).")
    elif not head_sha.lower().startswith(head):
        problems.append(f"The evidence is stale: it names {head[:10]}, but the pull request's head is {head_sha[:10]}. "
                        "Review the new lines and update the block.")
    if findings is None:
        problems.append("The evidence has no Findings line.")
    else:
        reason = important_open(findings)
        if reason:
            problems.append(reason)
    if reviewer is None:
        problems.append("The evidence has no Reviewer line (tool and session).")
    if verified_by(field(evidence, "Verified by")) is None:
        problems.append("The evidence has no \"Verified by\" answer: say what you ran.")
    if problems:
        return False, f"{len(problems)} problem(s) with the review evidence", "\n".join(f"- {p}" for p in problems)
    return True, "Review evidence is current", (
        f"The evidence names head {head[:10]}, no Important finding is open, and the CEO summary is filled in. "
        "Nits and pre-existing findings do not block the merge."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--repo", required=True)
    parser.add_argument("--pr", required=True)
    parser.add_argument("--head-sha", required=True)
    args = parser.parse_args(argv)

    pr = gh_api(f"repos/{args.repo}/pulls/{args.pr}")
    if pr.get("draft"):
        publish(args.repo, args.head_sha, status="in_progress", title="Draft pull request",
                summary="The evidence is checked when the pull request is marked ready for review.")
        return 0
    passed, title, summary = evaluate(pr.get("body") or "", args.head_sha)
    publish(args.repo, args.head_sha, status="completed",
            conclusion="success" if passed else "failure", title=title, summary=summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
