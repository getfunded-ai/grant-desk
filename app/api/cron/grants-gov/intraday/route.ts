import { createAdminClient } from "@/lib/db/admin";
import { authorizeCron } from "@/lib/grants-gov/cron";
import { describeError, runIntradayUpdate } from "@/lib/grants-gov/sync";
import { createSupabaseWriter } from "@/lib/grants-gov/writer";

/**
 * Intraday Grants.gov update. Picks up recent postings from the search API and refreshes every
 * tracked opportunity's full record (packages, attachments, status, close date).
 *
 * Vercel Cron entry a maintainer adds to vercel.json (high tier, not Phase D's to edit):
 *   { "path": "/api/cron/grants-gov/intraday", "schedule": "0 13,17,21 * * *" }
 * By hand: curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/grants-gov/intraday
 * Optional: ?days=7 (postings window) and ?max=300 (detail calls per run).
 */
export const maxDuration = 300;

function readInt(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.max(min, Math.min(n, max));
}

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return Response.json(
      { ok: false, error: "Supabase is not configured on this deployment" },
      { status: 503 },
    );
  }

  const params = new URL(request.url).searchParams;
  try {
    const result = await runIntradayUpdate({
      writer: createSupabaseWriter(admin),
      days: readInt(params.get("days"), 3, 1, 56),
      maxDetails: readInt(params.get("max"), 150, 1, 1000),
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = describeError(error);
    console.error("grants-gov intraday failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
