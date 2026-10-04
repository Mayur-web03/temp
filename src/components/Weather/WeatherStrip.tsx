import { Badge } from "@/components/ui/badge";
import { useOpsStore } from "@/store/ops-store";

export function WeatherStrip() {
  const world = useOpsStore((s) => s.world);
  const selected = useOpsStore((s) => s.selectedUnitId);
  const locByUnit = Object.fromEntries(world.units.map((u) => [u.id, u.locationId]));
  const focusLoc = locByUnit[selected];

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {world.weather.map((wx) => {
        const loc = world.locations.find((l) => l.id === wx.locationId);
        const active = wx.locationId === focusLoc;
        return (
          <div
            key={wx.locationId}
            className={`min-w-[11rem] flex-1 rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-border)] ${active ? "shadow-[var(--shadow-border-hover)]" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-[0.7rem] uppercase tracking-[0.16em] text-muted">{loc?.code ?? wx.locationId}</p>
              <Badge tone={wx.source && wx.source !== "seed" ? "ok" : "default"}>
                {wx.source === "open-meteo" ? "Open-Meteo" : wx.source === "met-norway" ? "MET" : "seed"}
              </Badge>
            </div>
            <p className="mt-1 font-mono text-2xl tabular-nums">
              {wx.tempC.toFixed(0)}°
              <span className="ml-1 text-sm text-muted">{wx.windKmh.toFixed(0)} km/h</span>
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{wx.summary}</p>
            <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
              vis {wx.visibilityKm.toFixed(1)} km · snow {Math.round(wx.snowProb * 100)}%
            </p>
          </div>
        );
      })}
    </div>
  );
}
