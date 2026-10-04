import { cacheGet, cacheSet, TTL } from "@/api/cache";
import { fetchJson } from "@/api/http";
import type { OsmWay } from "@/api/types";
import type { GeoPoint } from "@/types/domain";

const ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

type OverpassResponse = {
  elements?: Array<{
    tags?: Record<string, string>;
  }>;
};

function queryFor(points: GeoPoint[]): string {
  const sample = points.slice(0, 4);
  const around = sample
    .map((p) => `way["highway"](around:3500,${p.lat.toFixed(4)},${p.lng.toFixed(4)});`)
    .join("\n");
  return `[out:json][timeout:6];\n(\n${around}\n);\nout tags 24;`;
}

function parseWays(data: OverpassResponse): OsmWay[] {
  const ways: OsmWay[] = [];
  for (const el of data.elements ?? []) {
    const t = el.tags;
    if (!t) continue;
    ways.push({
      highway: t.highway,
      surface: t.surface,
      name: t.name ?? t.ref,
      bridge: t.bridge === "yes" || t.bridge === "true",
      tunnel: t.tunnel === "yes" || t.tunnel === "true",
      tracktype: t.tracktype,
    });
  }
  return ways;
}

export async function getOsmWays(points: GeoPoint[]): Promise<{ ways: OsmWay[]; provider: string; cached: boolean }> {
  if (points.length === 0) return { ways: [], provider: "none", cached: false };
  const key = `osm.${points.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join(";")}`;
  const cached = cacheGet<OsmWay[]>(key);
  if (cached) return { ways: cached, provider: "overpass", cached: true };

  const body = queryFor(points);
  let lastErr = "no endpoint";
  for (const endpoint of ENDPOINTS) {
    try {
      const data = await fetchJson<OverpassResponse>(endpoint, {
        method: "POST",
        timeoutMs: 5000,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(body)}`,
      });
      const ways = parseWays(data);
      cacheSet(key, ways, TTL.osm);
      return { ways, provider: endpoint.replace("https://", "").split("/")[0] ?? "overpass", cached: false };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastErr);
}

export function waysNear(_from: GeoPoint, _to: GeoPoint, ways: OsmWay[]): OsmWay[] {
  return ways.slice(0, 24);
}
