import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GrantForm } from "@/components/pipeline/grant-form";
import { requireActiveOrganization } from "@/lib/auth/session";
import { dateInZone } from "@/lib/calendar/tz";
import { userDb } from "@/lib/pipeline/client";
import { canEdit } from "@/lib/pipeline/permissions";
import { getGrant, listFunders } from "@/lib/pipeline/store";

export const metadata = { title: "Edit grant · Grant Desk" };

export default async function EditGrantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { active } = await requireActiveOrganization();
  if (!canEdit(active.role)) redirect(`/grants/${id}`);
  const db = await userDb();
  if (!db) notFound();
  const [detail, funders] = await Promise.all([
    getGrant(db, active.id, id),
    listFunders(db, active.id),
  ]);
  if (!detail) notFound();
  const { grant } = detail;

  // The stored moment is shown back as a date and time in UTC; a person can change the zone.
  const due = grant.submission_due_at ? new Date(grant.submission_due_at) : null;
  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Edit {grant.title}</h1>
        <Link href={`/grants/${grant.id}`} className="text-sm underline underline-offset-4">
          Back to the grant
        </Link>
      </div>
      <GrantForm
        values={{
          grantId: grant.id,
          title: grant.title,
          funderId: grant.funder_id,
          preset: grant.preset,
          amountRequested: grant.amount_requested === null ? "" : String(grant.amount_requested),
          amountAwarded: grant.amount_awarded === null ? "" : String(grant.amount_awarded),
          dueDate: due ? dateInZone(due, "UTC") : "",
          dueTime: due ? due.toISOString().slice(11, 16) : "",
          dueZone: due ? "UTC" : "",
          decisionDate: grant.decision_date ?? "",
          awardStartDate: grant.award_start_date ?? "",
          awardEndDate: grant.award_end_date ?? "",
        }}
        funders={funders.map((f) => ({ id: f.id, name: f.name }))}
        defaultZone="America/New_York"
      />
    </div>
  );
}
