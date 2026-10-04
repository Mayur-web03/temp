import { useEffect, useRef } from "react";
import { pctPts } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useOpsStore } from "@/store/ops-store";
import type { GeoPoint } from "@/types/domain";

function toneColor(risk: number) {
  if (risk >= 0.55) return "#c45c4a";
  if (risk >= 0.28) return "#c4a574";
  return "#7d9a78";
}

function confColor(conf: number) {
  if (conf >= 0.7) return "#7d9a78";
  if (conf >= 0.45) return "#c4a574";
  return "#c45c4a";
}

export function OpsMap({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const world = useOpsStore((s) => s.world);
  const posts = useOpsStore((s) => s.report.posts);
  const selected = useOpsStore((s) => s.selectedUnitId);
  const selectPost = useOpsStore((s) => s.selectPost);
  const scenario = useOpsStore((s) => s.scenario);
  const previewHit = useOpsStore((s) => s.previewHit);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !hostRef.current) return;

      const m = L.map(hostRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      });
      map = m;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OSM &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 12,
      }).addTo(m);

      const locById = Object.fromEntries(world.locations.map((l) => [l.id, l]));
      const postByLoc = Object.fromEntries(posts.map((p) => [p.location.id, p]));

      for (const route of world.routes) {
        const from = locById[route.fromLocationId];
        const to = locById[route.toLocationId];
        if (!from || !to) continue;
        const dest = postByLoc[to.id];
        const conf = dest?.deliveryConfidence ?? 0.5;
        const dashed = route.mode === "helicopter";
        const snowMute = scenario.snowClosure && route.mode !== "helicopter" && to.elevationM >= 5000;
        const src = route.source === "osrm" ? "OSRM" : "overlay";
        L.polyline(
          route.path.map((p: GeoPoint) => [p.lat, p.lng] as [number, number]),
          {
            color: snowMute ? "#5e6359" : confColor(conf),
            weight: dashed ? 2 : 3,
            opacity: dashed ? 0.75 : 0.9,
            dashArray: dashed ? "6 8" : scenario.routeDamaged && route.id === "r-fob-a12" ? "2 6" : undefined,
          },
        )
          .bindTooltip(
            `${route.name} · ${route.mode} · ${route.distanceKm.toFixed(0)} km · ${src}` +
              (route.roadName ? ` · ${route.roadName}` : ""),
            { sticky: true },
          )
          .addTo(m);
      }

      const bounds: [number, number][] = [];
      for (const loc of world.locations) {
        bounds.push([loc.point.lat, loc.point.lng]);
        const post = postByLoc[loc.id];
        const unit = world.units.find((u) => u.locationId === loc.id);
        const risk = post?.worst.stockoutRisk ?? 0.1;
        const selectedHere = unit?.id === selected;
        const icon = L.divIcon({
          className: "",
          iconSize: [selectedHere ? 92 : 78, 36],
          iconAnchor: [selectedHere ? 46 : 39, 18],
          html: `<div style="
            display:flex;align-items:center;gap:6px;padding:4px 8px;
            border-radius:999px;background:#151613;color:#eceee6;
            box-shadow:0 0 0 ${selectedHere ? 2 : 1}px ${toneColor(risk)};
            font:600 11px Barlow,sans-serif;white-space:nowrap">
            <span style="width:8px;height:8px;border-radius:99px;background:${toneColor(risk)}"></span>
            ${loc.code}
          </div>`,
        });
        const marker = L.marker([loc.point.lat, loc.point.lng], { icon }).addTo(m);
        const html = post
          ? `<strong>${post.unit.callsign}</strong><br/>${post.item.short} stockout ${pctPts(post.worst.stockoutRisk * 100)}<br/>${loc.elevationM} m`
          : `<strong>${loc.name}</strong><br/>${loc.kind} · ${loc.elevationM} m`;
        marker.bindPopup(html);
        if (unit && unit.echelon === "post") {
          marker.on("click", () => selectPost(unit.id));
        }
      }

      if (previewHit) {
        L.circleMarker([previewHit.latitude, previewHit.longitude], {
          radius: 8,
          color: "#d5d8ce",
          weight: 2,
          fillColor: "#7d9a78",
          fillOpacity: 0.85,
        })
          .bindPopup(
            `<strong>${previewHit.name}</strong><br/>${previewHit.latitude.toFixed(3)}N ${previewHit.longitude.toFixed(3)}E` +
              (previewHit.elevation != null ? `<br/>${Math.round(previewHit.elevation)} m` : ""),
          )
          .addTo(m)
          .openPopup();
        bounds.push([previewHit.latitude, previewHit.longitude]);
      }

      if (bounds.length) m.fitBounds(bounds, { padding: [28, 28] });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [world, posts, selected, selectPost, scenario, previewHit]);

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]", className)}>
      <div ref={hostRef} className="h-full min-h-[280px] w-full" />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-bg/80 px-2 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
        Solid = ground · dashed = air · colour = delivery confidence
      </div>
    </div>
  );
}
