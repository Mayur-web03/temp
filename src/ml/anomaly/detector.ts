import { mean } from "@/lib/utils";
import type { ConsumptionSeries } from "@/types/domain";

export function detectAnomaly(series: ConsumptionSeries | undefined) {
  if (!series || series.daily.length < 14) return { flagged: false, z: 0, latest: 0, baseline: 0 };
  const hist = series.daily.slice(0, -1);
  const latest = series.daily[series.daily.length - 1] ?? 0;
  const mu = mean(hist);
  const variance = mean(hist.map((x) => (x - mu) ** 2));
  const sd = Math.sqrt(variance) || 1;
  const z = (latest - mu) / sd;
  return { flagged: z > 2.4, z, latest, baseline: mu };
}
