import type { ScenarioFlags } from "@/types/domain";

export const SCENARIO_META: Array<{
  key: keyof ScenarioFlags;
  label: string;
  blurb: string;
}> = [
  {
    key: "snowClosure",
    label: "Snow closure",
    blurb: "High passes ice over. Track confidence collapses; P90 road time stretches past stock.",
  },
  {
    key: "helicopterAvailable",
    label: "Helicopter available",
    blurb: "One medium-lift airframe at FOB Nubra. Weather abort still in the model.",
  },
  {
    key: "routeDamaged",
    label: "Route damaged",
    blurb: "Washout on the Nubra–ALPHA-12 hairpin. Track treated as closed.",
  },
  {
    key: "crossLevelStock",
    label: "Cross-level stock",
    blurb: "Authorise BRAVO-7 to release surplus ECC across the ridge track.",
  },
];

export const EMPTY_SCENARIO: ScenarioFlags = {
  snowClosure: false,
  helicopterAvailable: false,
  routeDamaged: false,
  crossLevelStock: false,
};

export function recommendedPlanFlags(current: ScenarioFlags): ScenarioFlags {
  return {
    ...current,
    helicopterAvailable: true,
    crossLevelStock: true,
  };
}
