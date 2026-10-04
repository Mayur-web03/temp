import { createFileRoute } from "@tanstack/react-router";
import { AlertList } from "@/components/Dashboard/AlertList";
import { GeocodeSearch } from "@/components/Map/GeocodeSearch";
import { LegendPanel } from "@/components/Map/LegendPanel";
import { OpsMap } from "@/components/Map/OpsMap";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { WeatherStrip } from "@/components/Weather/WeatherStrip";

export const Route = createFileRoute("/_command/map")({
  component: MapPage,
});

function MapPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Route risk map</h1>
        <p className="mt-1 text-sm text-muted">
          OSRM roads where OSM has them. High-pass military tracks stay as overlays when the civilian network
          does not reach the post.
        </p>
      </div>
      <GeocodeSearch />
      <WeatherStrip />
      <OpsMap className="min-h-[420px] lg:min-h-[560px]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <LegendPanel />
        <Card>
          <CardHeader>
            <CardTitle>Post risk</CardTitle>
          </CardHeader>
          <AlertList />
        </Card>
      </div>
    </div>
  );
}
