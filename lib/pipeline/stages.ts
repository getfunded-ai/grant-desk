import { GRANT_STAGES, type Enums, type GrantStage } from "@/lib/db/types";

/** Pure: stage order and labels. Safe to import from client components and tests. */

export type Preset = Enums<"pipeline_preset">;

export { GRANT_STAGES };
export type { GrantStage };

/**
 * Labels per preset. The stored stage is always one of the ten `grant_stage` values; the SBIR
 * preset only changes what the person sees (pitch → invited → full application → go/no-go).
 */
export const STAGE_LABELS: Record<Preset, Record<GrantStage, string>> = {
  standard: {
    prospect: "Prospect",
    qualifying: "Qualifying",
    loi: "Letter of intent",
    application: "Application",
    submitted: "Submitted",
    awarded: "Awarded",
    declined: "Declined",
    active: "Active",
    reporting: "Reporting",
    closed: "Closed",
  },
  sbir: {
    prospect: "Topic fit",
    qualifying: "Pitch",
    loi: "Invited",
    application: "Full application",
    submitted: "Submitted",
    awarded: "Awarded",
    declined: "Declined",
    active: "Phase I active",
    reporting: "Go/No-Go",
    closed: "Closed",
  },
};

export const PRESET_LABELS: Record<Preset, string> = {
  standard: "Standard",
  sbir: "SBIR / STTR",
};

export function stageLabel(stage: GrantStage, preset: Preset = "standard"): string {
  return STAGE_LABELS[preset][stage];
}

export function isGrantStage(value: unknown): value is GrantStage {
  return typeof value === "string" && (GRANT_STAGES as readonly string[]).includes(value);
}

export function isPreset(value: unknown): value is Preset {
  return value === "standard" || value === "sbir";
}

/** Stages where a submission deadline still matters for reminders. */
export const STAGES_BEFORE_DECISION: readonly GrantStage[] = [
  "prospect",
  "qualifying",
  "loi",
  "application",
];
