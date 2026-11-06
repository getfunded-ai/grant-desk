"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/lib/auth/actions";
import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { findTrackedGrant } from "./store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Roles that may create a grant (Phase B's can_edit). Viewers only read. */
const EDITOR_ROLES = ["owner", "admin", "editor"];

/**
 * "Track this": creates a grant in stage prospect for the active organization, pointing at the
 * opportunity, and opens its record. Uses the person's own client, so row-level security checks
 * the membership and the data wall; the catalog row itself is never changed.
 */
export async function trackOpportunity(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, active } = await requireActiveOrganization();
  if (!EDITOR_ROLES.includes(active.role)) {
    return { status: "error", message: "Only an owner, admin or editor can track an opportunity." };
  }
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!UUID.test(opportunityId)) {
    return { status: "error", message: "That opportunity could not be found." };
  }
  const supabase = await createClient();
  if (!supabase) {
    return { status: "error", message: "The database is not set up on this copy of Grant Desk." };
  }

  const { data: opportunity, error: readError } = await supabase
    .from("opportunities")
    .select("id, title, source_system, source_url, external_id, opportunity_number")
    .eq("id", opportunityId)
    .maybeSingle();
  if (readError || !opportunity) {
    return { status: "error", message: "That opportunity could not be found." };
  }

  const existing = await findTrackedGrant(supabase, active.id, opportunityId);
  // The grant record page arrives with Phase E; until then the opportunity page shows the tracked state.
  if (existing) redirect(`/opportunities/${opportunityId}`);

  const title = String(opportunity.title).slice(0, 500);
  const { data: grant, error: insertError } = await supabase
    .from("grants")
    .insert({
      organization_id: active.id,
      opportunity_id: opportunityId,
      title,
      stage: "prospect",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insertError || !grant) {
    console.error("trackOpportunity failed", { code: insertError?.code });
    return { status: "error", message: "We could not create the grant. Try again." };
  }

  const { error: logError } = await supabase.from("activity_log").insert({
    organization_id: active.id,
    grant_id: grant.id,
    actor_kind: "person",
    actor_id: user.id,
    action: "opportunity.tracked",
    summary: `Started tracking "${title}" from ${opportunity.source_system === "grants_gov" ? "Grants.gov" : "the opportunity list"}.`,
    details: {
      opportunity_id: opportunityId,
      source_system: opportunity.source_system,
      source_url: opportunity.source_url,
      external_id: opportunity.external_id,
      opportunity_number: opportunity.opportunity_number,
    },
  });
  if (logError)
    console.error("trackOpportunity: activity line not written", { code: logError.code });

  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/opportunities");
  redirect(`/opportunities/${opportunityId}`);
}
