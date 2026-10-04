import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { detectAnomaly } from "@/ml/anomaly/detector";
import { useOpsStore } from "@/store/ops-store";

export function DriverList() {
  const focus = useOpsStore((s) => s.report.focus);
  const world = useOpsStore((s) => s.world);
  const series = world.consumption.find(
    (c) => c.unitId === focus.unit.id && c.itemId === focus.item.id,
  );
  const anomaly = detectAnomaly(series);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demand drivers</CardTitle>
      </CardHeader>
      <ul className="space-y-3">
        {focus.forecast.drivers.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3 text-sm">
            <span>{d.name}</span>
            <span className="font-mono tabular-nums text-muted">×{d.multiplier.toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">
        {anomaly.flagged
          ? `Anomaly: latest consumption z=${anomaly.z.toFixed(1)} vs 90-day baseline.`
          : `No consumption anomaly. Latest ${anomaly.latest.toFixed(0)} vs baseline ${anomaly.baseline.toFixed(0)}.`}
      </p>
    </Card>
  );
}
