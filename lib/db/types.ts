// The database types every phase imports. Generated types live in types/supabase.ts
// (`pnpm db:types` after a migration); this file only re-exports them with short names.

import {
  Constants,
  type Database,
  type Enums,
  type Tables,
  type TablesInsert,
  type TablesUpdate,
} from "@/types/supabase";

export { Constants };
export type { Database, Enums, Tables, TablesInsert, TablesUpdate };

export type GrantStage = Enums<"grant_stage">;
export type MembershipRole = Enums<"membership_role">;
export type OpportunityStatus = Enums<"opportunity_status">;
export type ProposalStatus = Enums<"proposal_status">;

/** The ten pipeline stages, in board order. */
export const GRANT_STAGES: readonly GrantStage[] = Constants.public.Enums.grant_stage;

/** Roles, strongest first. Owners and admins manage members; viewers only read. */
export const MEMBERSHIP_ROLES: readonly MembershipRole[] = Constants.public.Enums.membership_role;
