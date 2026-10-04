import type { InventoryRisk, QuantileForecast } from "@/types/domain";

/** Days of cover still required after a lift of `qty` arrives. */
export function residualCoverDays(inv: InventoryRisk, forecast: QuantileForecast, qty: number) {
  return (inv.onHand + qty) / Math.max(0.2, forecast.p50);
}

export function gapToSafety(inv: InventoryRisk, forecast: QuantileForecast, safetyDays = 7) {
  return Math.max(0, safetyDays * forecast.p50 - inv.onHand);
}
