import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { runReminders } from "@/lib/email/run-reminders";

/**
 * The reminders run. Vercel Cron calls it with `Authorization: Bearer <CRON_SECRET>`; a maintainer
 * can call it by hand the same way. Without CRON_SECRET the route refuses every call, so a copy
 * that was never set up cannot be made to send mail. The schedule itself lives in vercel.json,
 * which is a maintainer's file: see docs/PROGRESS.md for the one line to add.
 */

export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("cron/reminders: CRON_SECRET is not set; nothing ran");
    return NextResponse.json(
      { error: "CRON_SECRET is not set on this deployment" },
      { status: 503 },
    );
  }
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!sameSecret(given, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.warn(
      "cron/reminders: database not configured",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "The database is not configured on this deployment" },
      { status: 503 },
    );
  }

  const summary = await runReminders(admin, { appOrigin: new URL(request.url).origin });
  console.info("cron/reminders", JSON.stringify(summary));
  return NextResponse.json(summary);
}

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
