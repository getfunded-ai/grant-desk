import { requireActiveOrganization } from "@/lib/auth/session";
import { getDb } from "@/lib/learning/db";
import { renderPacketMarkdown } from "@/lib/learning/packet";
import { getPlaybook } from "@/lib/learning/playbooks";
import { getSession } from "@/lib/learning/queries";
import type { Packet } from "@/lib/learning/types";

/** The packet as a Markdown file, read as the signed-in person (row-level security applies). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { active } = await requireActiveOrganization();
  const db = await getDb();
  if (!db) return new Response("Not available", { status: 503 });
  const session = await getSession(db, active.id, id);
  if (!session) return new Response("Not found", { status: 404 });
  const playbook = getPlaybook(session.playbook_key);
  const markdown = renderPacketMarkdown(
    session.packet as unknown as Packet,
    playbook ?? { title: session.playbook_key, body: "Playbook text not available." },
  );
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="learning-session-${session.number}.md"`,
      "cache-control": "private, no-store",
    },
  });
}
