import { cacheGet, cacheSet, TTL } from "@/api/cache";
import { fetchJson } from "@/api/http";
import { toWeatherNow } from "@/api/adapters";
import type { WeatherRaw } from "@/api/types";
import type { Location, WeatherNow } from "@/types/domain";

type MetNoResponse = {
  geometry?: { coordinates?: number[] };
  properties?: {
    timeseries?: Array<{
      time: string;
      data: {
        instant?: { details?: Record<string, number> };
        next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
        next_6_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
      };
    }>;
  };
};

function rawFromMet(data: MetNoResponse): WeatherRaw {
  const t0 = data.properties?.timeseries?.[0];
  const inst = t0?.data.instant?.details ?? {};
  const n1 = t0?.data.next_1_hours;
  const n6 = t0?.data.next_6_hours;
  const windMs = inst.wind_speed ?? 0;
  const precipMm = n6?.details?.precipitation_amount ?? n1?.details?.precipitation_amount ?? 0;
  const symbol = n1?.summary?.symbol_code ?? n6?.summary?.symbol_code ?? "";
  const snowy = /snow|sleet/i.test(symbol);
  return {
    tempC: inst.air_temperature ?? 0,
    windKmh: windMs * 3.6,
    visibilityKm: null,
    precipMm,
    snowfallCm: snowy ? Math.max(precipMm, 0.4) : 0,
    precipProb: precipMm > 0.2 ? 0.55 : precipMm > 0 ? 0.25 : /rain|snow|sleet/i.test(symbol) ? 0.4 : 0.05,
    humidityPct: inst.relative_humidity ?? null,
    cloudCoverPct: inst.cloud_area_fraction ?? null,
    weatherCode: null,
    symbol,
  };
}

export async function getMetNoWeather(loc: Location): Promise<{ weather: WeatherNow; elevationM: number | null; cached: boolean }> {
  const key = `metno.wx.${loc.id}.${loc.point.lat.toFixed(3)}.${loc.point.lng.toFixed(3)}`;
  const cached = cacheGet<{ weather: WeatherNow; elevationM: number | null }>(key);
  if (cached) return { ...cached, cached: true };

  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${loc.point.lat}&lon=${loc.point.lng}`;
  const data = await fetchJson<MetNoResponse>(url, { timeoutMs: 7000 });
  const elev = data.geometry?.coordinates?.[2];
  const weather = toWeatherNow(loc.id, rawFromMet(data), loc.elevationM, "met-norway");
  const elevationM = typeof elev === "number" ? elev : null;
  cacheSet(key, { weather, elevationM }, TTL.weather);
  return { weather, elevationM, cached: false };
}
