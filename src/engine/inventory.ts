import { clamp } from "@/lib/utils";
import type { InventoryRisk, QuantileForecast, StockLevel } from "@/types/domain";

export function inventoryRisk(stock: StockLevel, forecast: QuantileForecast): InventoryRisk {
  const daysP50 = stock.onHand / Math.max(0.2, forecast.p50);
  const daysP90 = stock.onHand / Math.max(0.2, forecast.p90);
  const stockoutRisk = clamp(1 / (1 + Math.exp((daysP50 - 5.2) * 0.72)), 0.02, 0.97);
  return {
    unitId: stock.unitId,
    itemId: stock.itemId,
    onHand: stock.onHand,
    daysOfStockP50: daysP50,
    daysOfStockP90: daysP90,
    stockoutRisk,
  };
}
