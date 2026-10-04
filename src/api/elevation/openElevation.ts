import { cacheGet, cacheSet, TTL } from "@/api/cache";
import { fetchJson, markRateLimited } from "@/api/http";
import { roundCoord } from "@/api/adapters";
import type { GeoPoint } from "@/types/domain";

type OeResponse = {
  results?: Array<{ latitude: number; longitude: number; elevation: number }>;
  code?: string;
  error?: string;
};
type OmElevResponse = { elevation?: number[] };

const OE_URL = "https://api.open-elevation.com/api/v1/lookup";
const OM_ELEV_URL = "https://api.open-meteo.com/v1/elevation";

function cacheKey(p: GeoPoint) {
  return `elev.${roundCoord(p.lat, 4)}.${roundCoord(p.lng, 4)}`;
}

function elevationKey(): string | undefined {
  const vite = import.meta.env.VITE_OPEN_ELEVATION_KEY?.trim();
  if (vite) return vite;
  if (typeof process !== "undefined") return process.env.OPEN_ELEVATION_API_KEY?.trim();
  return undefined;
}

async function openMeteoElevationBatch(points: GeoPoint[]): Promise<Array<number | null>> {
  const lat = points.map((p) => p.lat).join(",");
  const lng = points.map((p) => p.lng).join(",");
  const data = await fetchJson<OmElevResponse>(`${OM_ELEV_URL}?latitude=${lat}&longitude=${lng}`, {
    timeoutMs: 6000,
  });
  const elev = data.elevation ?? [];
  return points.map((_, i) => (Number.isFinite(elev[i]) ? (elev[i] as number) : null));
}

async function openElevationBatch(points: GeoPoint[]): Promise<Array<number | null>> {
  const key = elevationKey();
  const url = key ? `${OE_URL}?api_key=${encodeURIComponent(key)}` : OE_URL;
  const data = await fetchJson<OeResponse>(url, {
    method: "POST",
    timeoutMs: 6000,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    }),
  });
  if (data.code === "quota_exceeded" || (data.error && /quota|allowance/i.test(data.error))) {
    markRateLimited(OE_URL);
    throw new Error("Open-Elevation quota exceeded");
  }
  const rows = data.results ?? [];
  return points.map((_, i) => {
    const row = rows[i];
    return row && Number.isFinite(row.elevation) ? row.elevation : null;
  });
}

export async function getElevations(points: GeoPoint[]): Promise<{
  meters: Array<number | null>;
  provider: "open-elevation" | "open-meteo" | "cache" | "none";
}> {
  if (points.length === 0) return { meters: [], provider: "none" };

  const meters: Array<number | null> = points.map((p) => cacheGet<number>(cacheKey(p)));
  const missingIdx = meters.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0);
  if (missingIdx.length === 0) return { meters, provider: "cache" };

  const missing = missingIdx.map((i) => points[i]!);
  let filled: Array<number | null> = missing.map(() => null);
  let provider: "open-elevation" | "open-meteo" | "cache" | "none" = "none";

  try {
    filled = await openMeteoElevationBatch(missing);
    provider = "open-meteo";
  } catch {
    try {
      filled = await openElevationBatch(missing);
      provider = "open-elevation";
    } catch {
      provider = meters.some((v) => v != null) ? "cache" : "none";
    }
  }

  missingIdx.forEach((ptIdx, j) => {
    const v = filled[j];
    if (v != null) {
      meters[ptIdx] = v;
      cacheSet(cacheKey(points[ptIdx]!), v, TTL.elevation);
    }
  });

  return { meters, provider: meters.every((v) => v == null) ? "none" : provider };
}

export async function getElevation(point: GeoPoint): Promise<number | null> {
  const { meters } = await getElevations([point]);
  return meters[0] ?? null;
}
