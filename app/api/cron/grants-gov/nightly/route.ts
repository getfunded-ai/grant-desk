import { createAdminClient } from "@/lib/db/admin";
import { authorizeCron } from "@/lib/grants-gov/cron";
import { describeError, runNightlyExtract } from "@/lib/grants-gov/sync";
import { createSupabaseWriter } from "@/lib/grants-gov/writer";

/**
 * Nightly Grants.gov load. Streams the day's extract into the catalog.
 *
 * Vercel Cron entry a maintainer adds to vercel.json (high tier, not Phase D's to edit):
 *   { "path": "/api/cron/grants-gov/nightly", "schedule": "30 10 * * *" }
 * That is 5:30 am Eastern in winter, after Grants.gov publishes the file around 4:40 am.
 * By hand: curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/grants-gov/nightly
 * Add ?date=YYYYMMDD to load a particular day's file.
 */
export const maxDuration = 300;

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

  const date = new URL(request.url).searchParams.get("date");
  if (date && !/^\d{8}$/.test(date)) {
    return Response.json({ ok: false, error: "date must be YYYYMMDD" }, { status: 400 });
  }

  try {
    const result = await runNightlyExtract({
      writer: createSupabaseWriter(admin),
      date: date ?? undefined,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = describeError(error);
    console.error("grants-gov nightly failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
