import "server-only";

/**
 * Sending one plain-text email through Resend's HTTP API (no package needed). Without RESEND_API_KEY
 * and EMAIL_FROM (human step H-4) nothing is sent and the caller is told "skipped"; a send is only
 * reported as "sent" when Resend accepted it and returned an id. Nothing here fakes a delivery.
 */

export type SendResult =
  | { status: "sent"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export type OutgoingEmail = { to: string; subject: string; text: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return {
      status: "skipped",
      reason: "RESEND_API_KEY or EMAIL_FROM is not set (human step H-4)",
    };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // Resend's error body names the problem without the key; the key is never logged.
      const body = (await response.text()).slice(0, 300);
      return { status: "failed", error: `Resend answered ${response.status}: ${body}` };
    }
    const data = (await response.json()) as { id?: unknown };
    if (typeof data.id !== "string" || data.id === "") {
      return { status: "failed", error: "Resend answered without a message id" };
    }
    return { status: "sent", id: data.id };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "unknown error" };
  }
}
