import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Who may call a cron route. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the
 * CRON_SECRET environment variable is set; a maintainer can send the same header by hand with
 * curl. Without the variable the route refuses every call, so a deploy without the secret can
 * never be triggered by a stranger.
 */
export function authorizeCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not set on this deployment" },
      { status: 503 },
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  // Hash both sides so the comparison takes the same time whatever the lengths are.
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(secret).digest();
  if (!presented || !timingSafeEqual(a, b)) {
    return Response.json({ ok: false, error: "not authorized" }, { status: 401 });
  }
  return null;
}
