import { createFileRoute } from "@tanstack/react-router";
import { DriverList } from "@/components/Forecast/DriverList";
import { ForecastChart } from "@/components/Forecast/ForecastChart";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { daysLabel, qty } from "@/lib/format";
import { useOpsStore } from "@/store/ops-store";

export const Route = createFileRoute("/_command/forecast")({
  component: ForecastPage,
});

function ForecastPage() {
  const world = useOpsStore((s) => s.world);
  const selectedUnitId = useOpsStore((s) => s.selectedUnitId);
  const selectedItemId = useOpsStore((s) => s.selectedItemId);
  const selectUnit = useOpsStore((s) => s.selectUnit);
  const selectItem = useOpsStore((s) => s.selectItem);
  const focus = useOpsStore((s) => s.report.focus);
  const hist = (world.weatherHistory ?? []).filter((d) => {
    const loc = world.units.find((u) => u.id === selectedUnitId)?.locationId;
    return d.locationId === loc;
  });
  const last = hist[hist.length - 1];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Demand forecast</h1>
        <p className="mt-1 text-sm text-muted">
          Quantile demand from troop strength, altitude, live weather, and mission activity. When the Open-Meteo
          archive is available, the 90-day consumption series is weather-shaped instead of random.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg bg-surface px-3 shadow-[var(--shadow-border)]">
          <span className="text-xs uppercase tracking-wider text-muted">Post</span>
          <select
            className="h-11 w-full bg-transparent text-sm"
            value={selectedUnitId}
            onChange={(e) => selectUnit(e.target.value)}
          >
            {world.units
              .filter((u) => u.echelon === "post")
              .map((u) => (
                <option key={u.id} value={u.id} className="bg-surface">
                  {u.callsign}
                </option>
              ))}
          </select>
        </label>
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg bg-surface px-3 shadow-[var(--shadow-border)]">
          <span className="text-xs uppercase tracking-wider text-muted">Item</span>
          <select
            className="h-11 w-full bg-transparent text-sm"
            value={selectedItemId}
            onChange={(e) => selectItem(e.target.value)}
          >
            {world.items.map((it) => (
              <option key={it.id} value={it.id} className="bg-surface">
                {it.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {last ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted">
          Archive {hist.length} days · last {last.date} · {last.tempC.toFixed(1)}°C · snow {last.snowfallCm.toFixed(1)} cm ·
          rain {last.precipMm.toFixed(1)} mm
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <ForecastChart />
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory risk</CardTitle>
            </CardHeader>
            <p className="font-mono text-3xl tabular-nums">{daysLabel(focus.inventory.daysOfStockP50)}</p>
            <p className="mt-1 text-sm text-muted">
              {qty(focus.inventory.onHand, focus.item.unit)} on hand · P90 cover{" "}
              {daysLabel(focus.inventory.daysOfStockP90)}
            </p>
          </Card>
          <DriverList />
        </div>
      </div>
    </div>
  );
}
