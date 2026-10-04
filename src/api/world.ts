import {
  conditionFromOsm,
  conditionFromSpeed,
  downsample,
  landslideProbFrom,
  slopeFromElevations,
  typicalSlope,
} from "@/api/adapters";
import { getElevations } from "@/api/elevation/openElevation";
import { geocodePlace } from "@/api/geocode/openMeteoGeocode";
import { getOsmWays, waysNear } from "@/api/osm/overpass";
import { cachedFeed, idleFeed, liveFeed, type DataFeeds, type WeatherHistoryDay } from "@/api/types";
import { loadOps, writeLocalOps } from "@/api/persistence";
import { getOsrmRoute, helicopterLeg, osrmAcceptable } from "@/api/routing/osrm";
import { getMetNoWeather } from "@/api/weather/metNo";
import { getOpenMeteoHistory, getOpenMeteoWeather } from "@/api/weather/openMeteo";
import { poolMap } from "@/api/http";
import { buildSeedWorld } from "@/data/seed";
import { mulberry32 } from "@/lib/utils";
import type { ConsumptionSeries, Location, Route, WeatherNow, WorldSnapshot } from "@/types/domain";

function isoDaysAgo(n: number, from = new Date()) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function weatherForLocations(locations: Location[]): Promise<{
  weather: WeatherNow[];
  elevations: Map<string, number>;
  feed: DataFeeds["weather"];
}> {
  const elevations = new Map<string, number>();
  const weather: WeatherNow[] = [];
  let liveOm = 0;
  let liveMet = 0;
  let cached = 0;
  let lastErr = "";

  const results = await poolMap(locations, 3, async (loc) => {
    try {
      const om = await getOpenMeteoWeather(loc);
      if (om.elevationM != null) elevations.set(loc.id, om.elevationM);
      if (om.cached) cached += 1;
      else liveOm += 1;
      return om.weather;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "open-meteo";
      try {
        const met = await getMetNoWeather(loc);
        if (met.elevationM != null) elevations.set(loc.id, met.elevationM);
        if (met.cached) cached += 1;
        else liveMet += 1;
        return met.weather;
      } catch (err2) {
        lastErr = err2 instanceof Error ? err2.message : lastErr;
        return null;
      }
    }
  });

  const seedWx = Object.fromEntries(buildSeedWorld().weather.map((w) => [w.locationId, w]));
  results.forEach((got, i) => {
    const loc = locations[i]!;
    weather.push(got ?? seedWx[loc.id] ?? seedWx[locations[0]!.id]!);
  });

  const live = liveOm + liveMet;
  if (live > 0) {
    const provider = liveOm >= liveMet ? "Open-Meteo" : "MET Norway";
    const detail =
      liveOm && liveMet
        ? `${liveOm} Open-Meteo · ${liveMet} MET Norway fallback`
        : liveOm
          ? `${liveOm} posts`
          : `${liveMet} posts (Open-Meteo limited)`;
    return { weather, elevations, feed: liveFeed(provider, detail) };
  }
  if (cached > 0) {
    return { weather, elevations, feed: cachedFeed("weather cache", weather[0]?.fetchedAt ?? null, `${cached} posts`) };
  }
  return {
    weather,
    elevations,
    feed: idleFeed("seed", lastErr ? `APIs unavailable: ${lastErr.slice(0, 80)}` : "Using training-picture weather"),
  };
}

async function historyForLocations(locations: Location[]): Promise<{
  days: WeatherHistoryDay[];
  elevations: Map<string, number>;
}> {
  const start = isoDaysAgo(89);
  const end = isoDaysAgo(2);
  const elevations = new Map<string, number>();
  const days: WeatherHistoryDay[] = [];
  const results = await poolMap(locations, 2, async (loc) => {
    try {
      return await getOpenMeteoHistory(loc, start, end);
    } catch {
      return null;
    }
  });
  results.forEach((res, i) => {
    if (!res) return;
    const loc = locations[i]!;
    days.push(...res.days);
    if (res.elevationM != null) elevations.set(loc.id, res.elevationM);
  });
  return { days, elevations };
}

function consumeFromHistory(
  seed: ConsumptionSeries[],
  history: WeatherHistoryDay[],
  locations: Location[],
  units: WorldSnapshot["units"],
  items: WorldSnapshot["items"],
): ConsumptionSeries[] {
  if (history.length < 14) return seed;
  const locByUnit = Object.fromEntries(units.map((u) => [u.id, u.locationId]));
  const locById = Object.fromEntries(locations.map((l) => [l.id, l]));
  const itemById = Object.fromEntries(items.map((i) => [i.id, i]));
  const unitById = Object.fromEntries(units.map((u) => [u.id, u]));
  const histByLoc = new Map<string, WeatherHistoryDay[]>();
  for (const day of history) {
    const list = histByLoc.get(day.locationId) ?? [];
    list.push(day);
    histByLoc.set(day.locationId, list);
  }
  const rng = mulberry32(20261004);
  return seed.map((series) => {
    const unit = unitById[series.unitId];
    const item = itemById[series.itemId];
    if (!unit || !item) return series;
    const locId = locByUnit[unit.id];
    const loc = locId ? locById[locId] : undefined;
    const days = locId ? histByLoc.get(locId) : undefined;
    if (!days || days.length < 14 || !loc) return series;
    const mission = unit.mission === "high" ? 1.45 : unit.mission === "medium" ? 1.12 : 0.9;
    const alt = 1 + Math.max(0, loc.elevationM - 3000) / 4200;
    const base = unit.troopStrength * item.basePerPersonPerDay * mission * alt;
    const daily = days.map((d) => {
      const snow = d.snowfallCm > 0.4 ? 1 + Math.min(d.snowfallCm / 8, 0.5) : 1;
      const cold = d.tempC < -8 ? 1 + Math.min((-d.tempC - 8) * 0.015, 0.35) : 1;
      const clothing = item.category === "clothing" || item.category === "fuel" ? snow * cold : 1 + (snow - 1) * 0.35;
      return Math.max(1, Math.round(base * clothing * (0.86 + rng() * 0.28)));
    });
    return { ...series, startDate: days[0]!.date, daily };
  });
}

function slopeFromEnds(from: Location, to: Location, distKm: number): number {
  const rise = Math.abs(to.elevationM - from.elevationM);
  const run = Math.max(1, distKm * 1000);
  const avg = (Math.atan(rise / run) * 180) / Math.PI;
  return Number(Math.min(28, Math.max(typicalSlope(to.elevationM) * 0.45, avg * 2.2)).toFixed(1));
}

async function enrichRoutes(
  routes: Route[],
  locations: Location[],
): Promise<{ routes: Route[]; routing: DataFeeds["routing"]; osm: DataFeeds["osm"]; elevation: DataFeeds["elevation"] }> {
  const loc = Object.fromEntries(locations.map((l) => [l.id, l]));
  let osrmLive = 0;
  let osrmCached = 0;
  let osrmRejected = 0;
  let osrmFail = 0;

  const ground = routes.filter((r) => r.mode !== "helicopter");
  const air = routes.filter((r) => r.mode === "helicopter");

  const osrmResults = await poolMap(ground, 3, async (route) => {
    const from = loc[route.fromLocationId];
    const to = loc[route.toLocationId];
    if (!from || !to) return { route, live: false };
    try {
      const leg = await getOsrmRoute(from.point, to.point);
      if (!osrmAcceptable(leg, route)) {
        osrmRejected += 1;
        return { route: { ...route, source: "seed" as const }, live: false };
      }
      if (leg.cached) osrmCached += 1;
      else osrmLive += 1;
      const durationH = Math.max(leg.durationMin / 60, 0.15);
      const speed = leg.distanceKm / durationH;
      return {
        route: {
          ...route,
          distanceKm: Number(leg.distanceKm.toFixed(1)),
          path: leg.path,
          baseSpeedKmh: Number(speed.toFixed(1)),
          durationMin: Number(leg.durationMin.toFixed(0)),
          roadName: leg.roadName,
          roadCondition: conditionFromSpeed(speed, to.elevationM, route.roadCondition),
          source: "osrm" as const,
        },
        live: true,
      };
    } catch {
      osrmFail += 1;
      return { route: { ...route, source: "seed" as const }, live: false };
    }
  });

  const airRoutes = air.map((route) => {
    const from = loc[route.fromLocationId];
    const to = loc[route.toLocationId];
    if (!from || !to) return route;
    const leg = helicopterLeg(from, to, route);
    return {
      ...route,
      distanceKm: Number(leg.distanceKm.toFixed(1)),
      path: leg.path,
      durationMin: Number(leg.durationMin.toFixed(0)),
      source: "seed" as const,
    };
  });

  let enriched = [...osrmResults.map((r) => r.route), ...airRoutes];

  const samplePts = enriched.flatMap((r) => downsample(r.path, 6));
  let elevProvider: DataFeeds["elevation"] = idleFeed("catalog", "Endpoint elevations from weather DEM");
  try {
    const { meters, provider } = await getElevations(samplePts);
    if (provider !== "none" && meters.some((m) => m != null)) {
      let cursor = 0;
      enriched = enriched.map((route) => {
        const n = downsample(route.path, 6).length;
        const samples = meters.slice(cursor, cursor + n).filter((x): x is number => x != null);
        cursor += n;
        if (samples.length < 2) return route;
        const gain = Math.round(Math.max(...samples) - Math.min(...samples));
        return {
          ...route,
          slopeDeg: Number(slopeFromElevations(route.distanceKm, samples).toFixed(1)),
          elevationGainM: gain,
        };
      });
      const label =
        provider === "open-elevation" ? "Open-Elevation" : provider === "open-meteo" ? "Open-Meteo elevation" : "elevation cache";
      elevProvider =
        provider === "cache"
          ? cachedFeed(label, new Date().toISOString(), `${samplesCount(meters)} pts`)
          : liveFeed(label, `${samplesCount(meters)} pts`);
    }
  } catch (err) {
    elevProvider = idleFeed("catalog", err instanceof Error ? err.message.slice(0, 80) : "elevation unavailable");
  }

  enriched = enriched.map((route) => {
    if (route.elevationGainM != null) return route;
    const from = loc[route.fromLocationId];
    const to = loc[route.toLocationId];
    if (!from || !to || route.mode === "helicopter") return route;
    return {
      ...route,
      slopeDeg: slopeFromEnds(from, to, route.distanceKm),
      elevationGainM: Math.round(Math.abs(to.elevationM - from.elevationM)),
    };
  });

  let osmFeed: DataFeeds["osm"] = idleFeed("OSRM/OSM", "Road geometry from OSM via OSRM");
  try {
    const pts = locations.filter((l) => l.kind !== "post" || l.elevationM < 4800).map((l) => l.point);
    const osm = await getOsmWays(pts.length ? pts : locations.map((l) => l.point));
    enriched = enriched.map((route) => {
      const from = loc[route.fromLocationId];
      const to = loc[route.toLocationId];
      if (!from || !to || route.mode === "helicopter") return route;
      const near = waysNear(from.point, to.point, osm.ways);
      if (!near.length) return route;
      const speed = route.baseSpeedKmh;
      return {
        ...route,
        highway: near.find((w) => w.highway)?.highway ?? route.highway,
        surface: near.find((w) => w.surface)?.surface ?? route.surface,
        roadCondition: conditionFromOsm(near, route.roadCondition, speed),
      };
    });
    osmFeed = osm.cached
      ? cachedFeed("Overpass", null, osm.provider)
      : liveFeed("Overpass / OSM", `${osm.ways.length} ways · ${osm.provider}`);
  } catch (err) {
    const osrmNames = osrmLive + osrmCached;
    osmFeed =
      osrmNames > 0
        ? liveFeed("OSM via OSRM", "Overpass skipped — using OSRM/OSM geometry and road names")
        : idleFeed("seed", err instanceof Error ? err.message.slice(0, 80) : "Overpass unavailable");
  }

  const accepted = osrmLive + osrmCached;
  const routing: DataFeeds["routing"] =
    accepted > 0
      ? liveFeed(
          "OSRM",
          `${accepted} ground legs on OSM roads` +
            (osrmRejected ? ` · ${osrmRejected} high-pass overlays (no civilian road)` : "") +
            " · air corridors geometric",
        )
      : osrmFail + osrmRejected >= ground.length
        ? idleFeed("seed", "OSRM unavailable or off-network — catalog distances")
        : cachedFeed("OSRM", null, "cached legs");

  return { routes: enriched, routing, osm: osmFeed, elevation: elevProvider };
}

function samplesCount(meters: Array<number | null>) {
  return meters.filter((m) => m != null).length;
}

export async function assembleWorld(): Promise<WorldSnapshot> {
  const seed = buildSeedWorld();
  const ops = await loadOps();
  const locations = ops.locations.length ? ops.locations : seed.locations;
  const units = ops.units.length ? ops.units : seed.units;
  const items = ops.items.length ? ops.items : seed.items;
  const stock = ops.stock.length ? ops.stock : seed.stock;
  const shipments = ops.shipments.length ? ops.shipments : seed.shipments;
  const baseRoutes = ops.routes.length ? ops.routes : seed.routes;
  let consumption = ops.consumption.length ? ops.consumption : seed.consumption;

  const [wx, hist, theater] = await Promise.all([
    weatherForLocations(locations),
    historyForLocations(locations),
    geocodePlace("Leh").catch(() => []),
  ]);

  const elevMap = new Map<string, number>([...hist.elevations, ...wx.elevations]);
  const located = locations.map((l) => {
    const elev = elevMap.get(l.id);
    return elev != null ? { ...l, elevationM: Math.round(elev) } : l;
  });

  const { routes, routing, osm, elevation } = await enrichRoutes(baseRoutes, located);

  if (hist.days.length >= 14 && ops.source !== "supabase") {
    consumption = consumeFromHistory(consumption, hist.days, located, units, items);
  }

  const weather = wx.weather.map((w) => {
    const loc = located.find((l) => l.id === w.locationId);
    if (!loc || w.source === "seed") return w;
    return {
      ...w,
      landslideProb: landslideProbFrom({
        precipMm: w.precipMm ?? 0,
        snowfallCm: w.snowfallCm ?? 0,
        elevationM: loc.elevationM,
        slopeDeg: typicalSlope(loc.elevationM),
      }),
    };
  });

  const leh = theater[0];
  const elevLive = elevMap.size > 0;
  const feeds: DataFeeds = {
    weather: wx.feed,
    routing,
    elevation: elevLive
      ? elevation.status === "fallback"
        ? liveFeed("weather DEM", `${elevMap.size} posts from weather/archive feeds`)
        : elevation
      : elevation,
    osm,
    geocode: leh
      ? liveFeed("Open-Meteo Geocoding", `${leh.name} ${leh.latitude.toFixed(3)}N ${leh.longitude.toFixed(3)}E`)
      : idleFeed("Open-Meteo Geocoding", "Search available on the map"),
    ops: {
      status: ops.source === "supabase" ? "live" : "fallback",
      provider: ops.source === "supabase" ? "Supabase" : "local",
      fetchedAt: new Date().toISOString(),
      detail: ops.opsDetail,
    },
    iot: idleFeed("simulator", "IoT stays simulated"),
  };

  const world: WorldSnapshot = {
    generatedAt: new Date().toISOString(),
    sector: seed.sector,
    locations: located,
    units,
    items,
    stock,
    consumption,
    routes,
    weather,
    shipments,
    iot: seed.iot.map((row) => ({ ...row, updatedAt: new Date().toISOString() })),
    source: ops.source,
    feeds,
    weatherHistory: hist.days,
  };

  writeLocalOps(world);
  return world;
}
