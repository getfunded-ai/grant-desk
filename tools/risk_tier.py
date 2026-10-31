#!/usr/bin/env python3
"""Classify a pull request's changed files into a risk tier.

Reads the tier rules (glob patterns per tier) from a YAML file, matches every
changed path against them and prints one JSON object to stdout:

    {"tier": "high", "merge": "human",
     "matched": {"high": [{"rule": ".github/**", "files": [...]}], "medium": []}}

Highest matching tier wins; a path that matches no rule falls to ``default``.
A pattern is matched against the whole repository-relative path with
``fnmatch`` (so ``*`` and ``**`` both cross ``/``), and ``dir/**`` also matches
every path under ``dir/``. A bare file name such as ``REVIEW.md`` matches only
the root file. Always exits 0; the calling workflow decides what to do with the
result. On a broken rules file the answer is the safe one, ``high`` / ``human``,
with an ``error`` key saying why.

Usage:
    python3 tools/risk_tier.py --rules .github/risk-tiers.yml --files changed.txt
    python3 tools/risk_tier.py --rules .github/risk-tiers.yml src/core/x.gd docs/a.md

``--files -`` reads the newline-separated list from stdin.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import sys

import yaml

TIER_ORDER = ("low", "medium", "high")  # lowest to highest
SAFE_TIER = "high"
SAFE_MERGE = "human"


def normalize(path: str) -> str:
    """Repository-relative, forward slashes, no leading ./ or /."""
    cleaned = path.strip().replace("\\", "/")
    while cleaned.startswith("./"):
        cleaned = cleaned[2:]
    return cleaned.lstrip("/")


def matches(pattern: str, path: str) -> bool:
    """True when ``path`` matches ``pattern`` as a whole or sits under ``dir/**``."""
    pattern = normalize(pattern)
    if fnmatch.fnmatchcase(path, pattern):
        return True
    if pattern.endswith("/**"):
        return path.startswith(pattern[:-2])  # keeps the trailing slash: "dir/"
    return False


def rank(tier: str) -> int:
    return TIER_ORDER.index(tier) if tier in TIER_ORDER else len(TIER_ORDER)


def load_rules(rules_path: str) -> dict:
    with open(rules_path, encoding="utf-8") as handle:
        rules = yaml.safe_load(handle) or {}
    if not isinstance(rules, dict):
        raise ValueError("rules file must be a mapping")
    tiers = rules.get("tiers") or {}
    if not isinstance(tiers, dict):
        raise ValueError("'tiers' must map a tier name to a list of patterns")
    for tier, patterns in tiers.items():
        if tier not in TIER_ORDER:
            raise ValueError(f"unknown tier {tier!r}; use one of {', '.join(TIER_ORDER)}")
        if not isinstance(patterns, list) or not all(isinstance(p, str) for p in patterns):
            raise ValueError(f"tier {tier!r} must list string patterns")
    merge = rules.get("merge") or {}
    if not isinstance(merge, dict):
        raise ValueError("'merge' must map a tier name to 'auto' or 'human'")
    default = str(rules.get("default", "low"))
    if default not in TIER_ORDER:
        raise ValueError(f"unknown default tier {default!r}")
    return {"default": default, "merge": merge, "tiers": tiers}


def classify(rules: dict, paths: list[str]) -> dict:
    matched = {tier: [] for tier in rules["tiers"]}
    for tier, patterns in rules["tiers"].items():
        for pattern in patterns:
            hits = [path for path in paths if matches(pattern, path)]
            if hits:
                matched[tier].append({"rule": pattern, "files": hits})
    tier = rules["default"]
    for candidate in matched:
        if matched[candidate] and rank(candidate) > rank(tier):
            tier = candidate
    merge = str(rules["merge"].get(tier, SAFE_MERGE))
    return {"tier": tier, "merge": merge, "matched": matched}


def read_paths(list_file: str | None, positional: list[str]) -> list[str]:
    raw: list[str] = []
    if list_file:
        if list_file == "-":
            raw.extend(sys.stdin.read().splitlines())
        else:
            with open(list_file, encoding="utf-8") as handle:
                raw.extend(handle.read().splitlines())
    raw.extend(positional)
    seen: list[str] = []
    for item in raw:
        path = normalize(item)
        if path and path not in seen:
            seen.append(path)
    return seen


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--rules", default=".github/risk-tiers.yml", help="YAML rules file")
    parser.add_argument("--files", help="newline-separated list of changed paths ('-' for stdin)")
    parser.add_argument("paths", nargs="*", help="changed paths given directly")
    args = parser.parse_args(argv)

    try:
        rules = load_rules(args.rules)
        result = classify(rules, read_paths(args.files, args.paths))
    except Exception as exc:  # noqa: BLE001 - any failure must still print a verdict
        result = {
            "tier": SAFE_TIER,
            "merge": SAFE_MERGE,
            "matched": {},
            "error": f"{type(exc).__name__}: {exc}",
        }
    json.dump(result, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
