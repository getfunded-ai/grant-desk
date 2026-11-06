import { redirect } from "next/navigation";
import { GrantForm } from "@/components/pipeline/grant-form";
import { requireActiveOrganization } from "@/lib/auth/session";
import { userDb } from "@/lib/pipeline/client";
import { canEdit } from "@/lib/pipeline/permissions";
import { listFunders } from "@/lib/pipeline/store";

export const metadata = { title: "New grant · Grant Desk" };

export default async function NewGrantPage() {
  const { active } = await requireActiveOrganization();
  if (!canEdit(active.role)) redirect("/grants");
  const db = await userDb();
  const funders = db ? await listFunders(db, active.id) : [];
  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">New grant</h1>
        <p className="text-sm text-muted-foreground">
          A grant you are going after, or already have, from one funder. It starts in the first
          stage. Leave any amount or date empty until you know it.
        </p>
      </div>
      <GrantForm
        values={{
          title: "",
          funderId: null,
          preset: "standard",
          amountRequested: "",
          amountAwarded: "",
          dueDate: "",
          dueTime: "",
          dueZone: "",
          decisionDate: "",
          awardStartDate: "",
          awardEndDate: "",
        }}
        funders={funders.map((f) => ({ id: f.id, name: f.name }))}
        defaultZone="America/New_York"
      />
    </div>
  );
}
