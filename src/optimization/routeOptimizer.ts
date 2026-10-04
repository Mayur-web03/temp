import { rankOptions } from "@/optimization/scoring";
import type { ResupplyOption } from "@/types/domain";

/** Pick the highest-scoring feasible ground or air leg. */
export function pickBestRoute(options: ResupplyOption[]) {
  return rankOptions(options.filter((o) => o.kind !== "split_shipment" && o.feasible))[0] ?? null;
}
