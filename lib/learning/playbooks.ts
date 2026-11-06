import "server-only";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PLAYBOOK_KEYS, type OrganizationKind, type PlaybookKey } from "./types";

export type Playbook = {
  key: PlaybookKey;
  title: string;
  /** Which kinds of organization the playbook is for. */
  for: OrganizationKind[];
  steps: string[];
  /** The Markdown body after the front matter, copied into every packet. */
  body: string;
};

/** A static path, so the deployment bundle keeps the folder next to the server code. */
const PLAYBOOKS_DIR = join(process.cwd(), "content", "playbooks");

/**
 * Parses the small front matter the playbooks use: `key: value` lines and one `steps:` list of
 * `  - item` lines, between two `---` lines. No dependency, no YAML surprises.
 */
export function parsePlaybook(text: string): Playbook {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error("playbook has no front matter");
  const [, head, body] = match;
  const fields: Record<string, string> = {};
  const steps: string[] = [];
  let inSteps = false;
  for (const line of head.split(/\r?\n/)) {
    const step = /^\s+-\s+(.*)$/.exec(line);
    if (inSteps && step) {
      steps.push(step[1].trim());
      continue;
    }
    const field = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!field) continue;
    inSteps = field[1] === "steps";
    if (!inSteps) fields[field[1]] = field[2].trim();
  }
  const key = fields.key as PlaybookKey;
  if (!PLAYBOOK_KEYS.includes(key)) throw new Error(`unknown playbook key: ${fields.key}`);
  const kinds = (fields.for ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is OrganizationKind => s === "seeker" || s === "funder" || s === "company");
  return { key, title: fields.title ?? key, for: kinds, steps, body: body.trim() };
}

let cache: Map<PlaybookKey, Playbook> | null = null;

/** Every playbook in content/playbooks, read once per server process. */
export function listPlaybooks(): Playbook[] {
  if (!cache) {
    const loaded = new Map<PlaybookKey, Playbook>();
    for (const name of readdirSync(PLAYBOOKS_DIR)) {
      if (!name.endsWith(".md")) continue;
      const playbook = parsePlaybook(readFileSync(join(PLAYBOOKS_DIR, name), "utf8"));
      loaded.set(playbook.key, playbook);
    }
    cache = loaded;
  }
  return PLAYBOOK_KEYS.map((key) => cache!.get(key)).filter((p): p is Playbook => Boolean(p));
}

export function getPlaybook(key: PlaybookKey): Playbook | null {
  return listPlaybooks().find((p) => p.key === key) ?? null;
}
