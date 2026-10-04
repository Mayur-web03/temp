import { clamp } from "@/lib/utils";
import { runMonteCarlo } from "@/simulation/monteCarlo";
import type { QuantileForecast, RouteAssessment } from "@/types/domain";

export function deliveryConfidence(args: {
  onHand: number;
  forecast: QuantileForecast;
  route: RouteAssessment;
  available: boolean;
  abortProb?: number;
}) {
  if (!args.available || args.route.closed) {
    return {
      confidence: 0.04,
      stockout: 0.96,
      meanDays: args.route.meanDays,
      p90Days: args.route.p90Days,
      mc: runMonteCarlo({
        onHand: args.onHand,
        p10: args.forecast.p10,
        p50: args.forecast.p50,
        p90: args.forecast.p90,
        meanDays: Math.max(args.route.meanDays, 8),
        p90Days: Math.max(args.route.p90Days, 12),
        abortProb: 0.9,
        samples: 240,
      }),
    };
  }

  const abort = args.abortProb ?? (args.route.route.mode === "helicopter" ? 1 - args.route.confidence : 0.04);
  const mc = runMonteCarlo({
    onHand: args.onHand,
    p10: args.forecast.p10,
    p50: args.forecast.p50,
    p90: args.forecast.p90,
    meanDays: args.route.meanDays,
    p90Days: args.route.p90Days,
    abortProb: abort,
    samples: 640,
  });

  const conf = clamp(mc.pArriveBeforeStockout * (0.55 + 0.45 * args.route.confidence), 0.03, 0.97);
  return {
    confidence: conf,
    stockout: mc.pStockout,
    meanDays: args.route.meanDays,
    p90Days: mc.p90DeliveryDays,
    mc,
  };
}
