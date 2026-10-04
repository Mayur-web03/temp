import { airPath, downsample, haversineKm } from "@/api/adapters";
import { cacheGet, cacheSet, TTL } from "@/api/cache";
import { fetchJson } from "@/api/http";
import type { OsrmLeg } from "@/api/types";
import type { GeoPoint, Location, Route } from "@/types/domain";

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates?: number[][] };
    legs?: Array<{ steps?: Array<{ name?: string }> }>;
  }>;
  waypoints?: Array<{ distance?: number; location?: number[] }>;
};

function keyFor(from: GeoPoint, to: GeoPoint) {
  return `osrm.${from.lng.toFixed(4)},${from.lat.toFixed(4)}.${to.lng.toFixed(4)},${to.lat.toFixed(4)}`;
}

export function osrmAcceptable(leg: OsrmLeg, seed: Route): boolean {
  if (leg.path.length < 2) return false;
  if ((leg.snapFromM ?? 0) > 4000 || (leg.snapToM ?? 0) > 4000) return false;
  if (seed.distanceKm > 0 && leg.distanceKm > seed.distanceKm * 2.15 + 25) return false;
  if (leg.distanceKm < 0.4) return false;
  return true;
}

export async function getOsrmRoute(from: GeoPoint, to: GeoPoint): Promise<OsrmLeg> {
  const key = keyFor(from, to);
  const cached = cacheGet<OsrmLeg>(key);
  if (cached) return { ...cached, cached: true };

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://router.project-osrm.org/route/v1/driving/${coords}` +
    `?overview=simplified&geometries=geojson&steps=true`;
  const data = await fetchJson<OsrmResponse>(url, { timeoutMs: 7000 });
  const route = data.routes?.[0];
  if (!route || data.code !== "Ok") throw new Error("OSRM returned no route");

  const coordsLngLat = route.geometry?.coordinates ?? [];
  const path: GeoPoint[] = downsample(
    coordsLngLat.map(([lng, lat]) => ({ lat: lat ?? 0, lng: lng ?? 0 })),
    48,
  );
  const names = (route.legs?.[0]?.steps ?? []).map((s) => s.name).filter((n): n is string => Boolean(n && n.trim()));
  const roadName = names.sort((a, b) => b.length - a.length)[0];
  const snapFromM = data.waypoints?.[0]?.distance ?? 0;
  const snapToM = data.waypoints?.[1]?.distance ?? 0;
  const leg: OsrmLeg = {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    path: path.length >= 2 ? path : [from, to],
    roadName,
    snapFromM,
    snapToM,
    cached: false,
  };
  cacheSet(key, { ...leg, cached: false }, TTL.route);
  return leg;
}

export function helicopterLeg(from: Location, to: Location, fallback: Route): OsrmLeg {
  const path = airPath(from.point, to.point);
  const distanceKm = haversineKm(from.point, to.point);
  const speed = fallback.baseSpeedKmh || 185;
  return {
    distanceKm,
    durationMin: (distanceKm / speed) * 60,
    path,
    roadName: "air corridor",
    snapFromM: 0,
    snapToM: 0,
    cached: false,
  };
}
