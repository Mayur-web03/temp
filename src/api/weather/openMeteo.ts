import { cacheGet, cacheSet, TTL } from "@/api/cache";
import { fetchJson } from "@/api/http";
import { toWeatherNow } from "@/api/adapters";
import type { WeatherHistoryDay, WeatherRaw } from "@/api/types";
import type { Location, WeatherNow } from "@/types/domain";

type ForecastResponse = {
  elevation?: number;
  current?: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    visibility?: number;
    precipitation?: number;
    snowfall?: number;
    cloud_cover?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
  };
  hourly?: {
    precipitation_probability?: (number | null)[];
    snowfall?: (number | null)[];
    precipitation?: (number | null)[];
  };
  daily?: {
    precipitation_sum?: (number | null)[];
    snowfall_sum?: (number | null)[];
  };
};

type ArchiveResponse = {
  elevation?: number;
  daily?: {
    time?: string[];
    temperature_2m_mean?: (number | null)[];
    precipitation_sum?: (number | null)[];
    snowfall_sum?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
  };
};

function rawFromForecast(data: ForecastResponse): WeatherRaw {
  const c = data.current ?? {};
  const hourlyP = data.hourly?.precipitation_probability ?? [];
  const precipProb = Math.max(0, ...hourlyP.slice(0, 6).map((x) => (x ?? 0) / 100), 0);
  const visM = c.visibility;
  return {
    tempC: c.temperature_2m ?? 0,
    windKmh: c.wind_speed_10m ?? 0,
    visibilityKm: visM != null ? visM / 1000 : null,
    precipMm: c.precipitation ?? data.daily?.precipitation_sum?.[0] ?? 0,
    snowfallCm: (c.snowfall ?? data.daily?.snowfall_sum?.[0] ?? 0) as number,
    precipProb,
    humidityPct: c.relative_humidity_2m ?? null,
    cloudCoverPct: c.cloud_cover ?? null,
    weatherCode: c.weather_code ?? null,
  };
}

export async function getOpenMeteoWeather(
  loc: Location,
): Promise<{ weather: WeatherNow; elevationM: number | null; cached: boolean }> {
  const key = `om.wx.${loc.id}.${loc.point.lat.toFixed(3)}.${loc.point.lng.toFixed(3)}`;
  const cached = cacheGet<{ weather: WeatherNow; elevationM: number | null }>(key);
  if (cached) return { ...cached, cached: true };

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.point.lat}&longitude=${loc.point.lng}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,visibility,snowfall` +
    `&hourly=precipitation_probability,snowfall,precipitation` +
    `&daily=precipitation_sum,snowfall_sum&forecast_days=1&wind_speed_unit=kmh&timezone=auto`;
  const data = await fetchJson<ForecastResponse>(url, { timeoutMs: 6000 });
  const weather = toWeatherNow(loc.id, rawFromForecast(data), loc.elevationM, "open-meteo");
  const elevationM = typeof data.elevation === "number" ? data.elevation : null;
  cacheSet(key, { weather, elevationM }, TTL.weather);
  return { weather, elevationM, cached: false };
}

export async function getOpenMeteoHistory(
  loc: Location,
  startDate: string,
  endDate: string,
): Promise<{ days: WeatherHistoryDay[]; elevationM: number | null }> {
  const key = `om.hist.${loc.id}.${startDate}.${endDate}`;
  const cached = cacheGet<{ days: WeatherHistoryDay[]; elevationM: number | null }>(key);
  if (cached) return cached;

  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${loc.point.lat}&longitude=${loc.point.lng}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=temperature_2m_mean,precipitation_sum,snowfall_sum,wind_speed_10m_max&wind_speed_unit=kmh&timezone=UTC`;
  const data = await fetchJson<ArchiveResponse>(url, { timeoutMs: 8000 });
  const times = data.daily?.time ?? [];
  const days: WeatherHistoryDay[] = times.map((date, i) => ({
    date,
    locationId: loc.id,
    tempC: data.daily?.temperature_2m_mean?.[i] ?? 0,
    windKmh: data.daily?.wind_speed_10m_max?.[i] ?? 0,
    precipMm: data.daily?.precipitation_sum?.[i] ?? 0,
    snowfallCm: data.daily?.snowfall_sum?.[i] ?? 0,
  }));
  const payload = { days, elevationM: typeof data.elevation === "number" ? data.elevation : null };
  cacheSet(key, payload, TTL.historical);
  return payload;
}
