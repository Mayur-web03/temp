import { runDcre } from "@/engine/dcre";
import type { ScenarioFlags, WorldSnapshot } from "@/types/domain";

/** Re-score the world under an injected scenario without mutating the live picture. */
export function projectTwin(world: WorldSnapshot, scenario: ScenarioFlags, unitId: string, itemId: string) {
  return runDcre(world, scenario, { unitId, itemId });
}
