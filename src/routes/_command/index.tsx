import { createFileRoute } from "@tanstack/react-router";
import { AlertList } from "@/components/Dashboard/AlertList";
import { KpiStrip } from "@/components/Dashboard/KpiStrip";
import { FeedPanel } from "@/components/Feeds/FeedPanel";
import { OpsMap } from "@/components/Map/OpsMap";
import { ActionCard } from "@/components/Recommendation/ActionCard";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { WeatherStrip } from "@/components/Weather/WeatherStrip";
import { useOpsStore } from "@/store/ops-store";

export const Route = createFileRoute("/_command/")({
  component: CommandPage,
});

function CommandPage() {
  const focus = useOpsStore((s) => s.report.focus);
  const iot = useOpsStore((s) => s.world.iot);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Command picture</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Will the supply reach {focus.unit.callsign} before {focus.item.short} runs out? If not, the engine
          ranks the next best action. Weather, roads, and elevation are live public feeds.
        </p>
      </div>
      <WeatherStrip />
      <KpiStrip />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <OpsMap className="min-h-[340px] lg:min-h-[480px]" />
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Critical alerts</CardTitle>
            </CardHeader>
            <AlertList />
          </Card>
          <ActionCard />
          <FeedPanel />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>IoT picture</CardTitle>
        </CardHeader>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {iot.map((row) => (
            <li key={row.id} className="rounded-lg bg-surface-2 px-3 py-3">
              <p className="text-xs text-muted">{row.label}</p>
              <p className={`mt-1 font-mono text-lg tabular-nums ${row.ok ? "text-fg" : "text-danger"}`}>
                {row.value}
                <span className="ml-1 text-xs text-muted">{row.unit}</span>
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
