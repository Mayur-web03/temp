import { clamp, mulberry32, quantile } from "@/lib/utils";
import type { HistogramBin, MonteCarloResult } from "@/types/domain";

function sampleLognormal(rng: () => number, median: number, p90: number) {
  const mu = Math.log(Math.max(0.05, median));
  const sigma = Math.max(0.05, Math.log(Math.max(median * 1.01, p90) / median) / 1.2816);
  let u = 0;
  let v = 0;
  let s = 0;
  do {
    u = 2 * rng() - 1;
    v = 2 * rng() - 1;
    s = u * u + v * v;
  } while (s === 0 || s >= 1);
  const z = u * Math.sqrt((-2 * Math.log(s)) / s);
  return Math.exp(mu + sigma * z);
}

export function runMonteCarlo(args: {
  onHand: number;
  p10: number;
  p50: number;
  p90: number;
  meanDays: number;
  p90Days: number;
  abortProb?: number;
  samples?: number;
  seed?: number;
}): MonteCarloResult {
  const samples = args.samples ?? 800;
  const rng = mulberry32(args.seed ?? 9041);
  const abortProb = args.abortProb ?? 0;
  const remain: number[] = [];
  const days: number[] = [];
  let stockouts = 0;
  let arrived = 0;

  for (let i = 0; i < samples; i++) {
    const demand = sampleLognormal(rng, args.p50, args.p90);
    const transit = sampleLognormal(rng, Math.max(0.12, args.meanDays), Math.max(args.meanDays, args.p90Days));
    const aborted = rng() < abortProb;
    days.push(transit);
    if (aborted) {
      stockouts += 1;
      remain.push(args.onHand - demand * transit);
      continue;
    }
    const used = demand * transit;
    const leftover = args.onHand - used;
    remain.push(leftover);
    if (leftover <= 0) stockouts += 1;
    else arrived += 1;
  }

  remain.sort((a, b) => a - b);
  days.sort((a, b) => a - b);
  const lo = remain[0] ?? 0;
  const hi = remain[remain.length - 1] ?? 1;
  const bins = 16;
  const width = Math.max(1, (hi - lo) / bins);
  const histogram: HistogramBin[] = Array.from({ length: bins }, (_, i) => ({
    x0: lo + i * width,
    x1: lo + (i + 1) * width,
    n: 0,
  }));
  for (const x of remain) {
    const idx = clamp(Math.floor((x - lo) / width), 0, bins - 1);
    histogram[idx]!.n += 1;
  }

  const meanDaysRemaining =
    remain.reduce((s, x) => s + x, 0) / samples / Math.max(0.2, args.p50);

  return {
    samples,
    pStockout: stockouts / samples,
    pArriveBeforeStockout: arrived / samples,
    meanDaysRemaining,
    p90DeliveryDays: quantile(days, 0.9),
    remainingStock: histogram,
  };
}
