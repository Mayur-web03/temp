import { cacheGet, cacheSet, TTL } from "@/api/cache";
import { fetchJson } from "@/api/http";
import type { GeoHit } from "@/api/types";

type GeocodeResponse = {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    elevation?: number;
    country?: string;
    admin1?: string;
    timezone?: string;
  }>;
};

export async function geocodePlace(query: string, countryCode = "IN"): Promise<GeoHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = `geo.${countryCode}.${q.toLowerCase()}`;
  const cached = cacheGet<GeoHit[]>(key);
  if (cached) return cached;

  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}` +
    `&count=6&language=en&format=json&countryCode=${encodeURIComponent(countryCode)}`;
  const data = await fetchJson<GeocodeResponse>(url, { timeoutMs: 7000 });
  let hits: GeoHit[] = (data.results ?? []).map((r) => ({
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    elevation: r.elevation ?? null,
    country: r.country ?? null,
    admin1: r.admin1 ?? null,
    timezone: r.timezone ?? null,
  }));

  if (hits.length === 0) {
    const global = await fetchJson<GeocodeResponse>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`,
      { timeoutMs: 7000 },
    );
    hits = (global.results ?? []).map((r) => ({
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      elevation: r.elevation ?? null,
      country: r.country ?? null,
      admin1: r.admin1 ?? null,
      timezone: r.timezone ?? null,
    }));
  }

  cacheSet(key, hits, TTL.geocode);
  return hits;
}
