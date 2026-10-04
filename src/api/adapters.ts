import { clamp } from "@/lib/utils";
import type { RoadCondition, WeatherNow } from "@/types/domain";
import type { OsmWay, WeatherRaw } from "@/api/types";

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

export function snowProbFrom(raw: WeatherRaw): number {
  const snowCode = raw.weatherCode != null && SNOW_CODES.has(raw.weatherCode);
  const symbolSnow = Boolean(raw.symbol && /snow|sleet/i.test(raw.symbol));
  const fromFall = clamp(raw.snowfallCm / 6, 0, 0.7);
  const fromCode = snowCode || symbolSnow ? 0.32 : 0;
  const fromColdPrecip =
    raw.tempC <= 1 && raw.precipProb > 0 ? raw.precipProb * 0.45 : raw.tempC <= 1 && raw.precipMm > 0.2 ? 0.22 : 0;
  const fromTemp = raw.tempC < -10 ? 0.14 : raw.tempC < -4 ? 0.07 : 0;
  return clamp(fromFall + fromCode + fromColdPrecip + fromTemp, 0, 0.95);
}

/** Rain + snowmelt + slope + altitude proxy. Not a USGS landslide model. */
export function landslideProbFrom(args: {
  precipMm: number;
  snowfallCm: number;
  elevationM: number;
  slopeDeg: number;
}): number {
  const rain = clamp(args.precipMm / 48, 0, 1);
  const melt = args.snowfallCm > 0.4 && args.elevationM > 3500 ? 0.07 : 0;
  const slope = clamp(args.slopeDeg / 32, 0.18, 1);
  const elev = args.elevationM > 5000 ? 1.2 : args.elevationM > 4000 ? 1.08 : args.elevationM > 3000 ? 0.9 : 0.65;
  return clamp(0.03 + rain * 0.52 * slope * elev + melt, 0, 0.88);
}

export function typicalSlope(elevationM: number): number {
  if (elevationM >= 5200) return 17;
  if (elevationM >= 4500) return 13;
  if (elevationM >= 3800) return 9;
  return 6;
}

export function visibilityFromSymbol(raw: WeatherRaw): number {
  if (raw.visibilityKm != null && Number.isFinite(raw.visibilityKm)) {
    return clamp(raw.visibilityKm, 0.1, 30);
  }
  const s = raw.symbol ?? "";
  if (/fog|mist/i.test(s)) return 0.7;
  if (/heavysnow|snow/i.test(s)) return 2.4;
  if (/sleet|rain/i.test(s)) return 5.5;
  if (/cloud|overcast/i.test(s)) return 8;
  if (raw.weatherCode != null) {
    if (raw.weatherCode === 45 || raw.weatherCode === 48) return 0.6;
    if (SNOW_CODES.has(raw.weatherCode)) return 2.2;
    if (RAIN_CODES.has(raw.weatherCode)) return 6;
    if (raw.weatherCode >= 1 && raw.weatherCode <= 3) return 9;
  }
  return raw.cloudCoverPct != null && raw.cloudCoverPct > 80 ? 7 : 12;
}

export function wmoSummary(raw: WeatherRaw, visKm: number, windKmh: number): string {
  const code = raw.weatherCode;
  const snow = snowProbFrom(raw) >= 0.45;
  if (raw.symbol) {
    if (/heavysnow/i.test(raw.symbol)) return "Heavy snow. High-pass movement restricted.";
    if (/snow/i.test(raw.symbol)) return "Snow in the sector. Tracks icing on north faces.";
    if (/fog/i.test(raw.symbol)) return "Fog / reduced vis. Air abort risk at LZ.";
    if (/heavyrain|rain/i.test(raw.symbol) && raw.tempC < 2) return "Freezing rain risk. Surface slick.";
    if (/thunder/i.test(raw.symbol)) return "Convective cells. Air and high ground caution.";
    if (/clearsky|fair/i.test(raw.symbol) && raw.tempC < -8) return "Clear and severe cold. Tracks open with icing risk.";
    if (/clearsky|fair/i.test(raw.symbol)) return "Clear. Full MSRs open with caution.";
    if (/cloud|overcast/i.test(raw.symbol)) return "Broken to overcast. Passable with caution.";
  }
  if (code === 45 || code === 48) return "Fog. Ceiling and vis collapsing at the LZ.";
  if (code != null && SNOW_CODES.has(code)) {
    return visKm < 2 ? "Snow band, vis collapsing. High-pass hold likely." : "Scattered snow. Track icing on north face.";
  }
  if (code != null && RAIN_CODES.has(code)) return "Precipitation on the MSR. Landslide watch on cut slopes.";
  if (snow) return "Cold + precip. Snow probability elevated.";
  if (windKmh >= 40) return "Strong wind. Rotor and high-pass caution.";
  if (raw.tempC < -12) return "Severe cold. ECC demand up; batteries degrade.";
  if (code === 0) return "Clear valley. Full MSRs open.";
  if (code != null && code <= 3) return "Mostly clear to cloudy. Tracks open.";
  return visKm < 3 ? "Reduced vis. Air abort risk." : "Cold, gusty, passable with caution.";
}

export function toWeatherNow(locationId: string, raw: WeatherRaw, elevationM: number, source: WeatherNow["source"]): WeatherNow {
  const visKm = Number(visibilityFromSymbol(raw).toFixed(1));
  const windKmh = Number(raw.windKmh.toFixed(1));
  const snowProb = snowProbFrom(raw);
  const landslideProb = landslideProbFrom({
    precipMm: raw.precipMm,
    snowfallCm: raw.snowfallCm,
    elevationM,
    slopeDeg: typicalSlope(elevationM),
  });
  return {
    locationId,
    tempC: Number(raw.tempC.toFixed(1)),
    windKmh,
    visibilityKm: visKm,
    snowProb,
    landslideProb,
    ceilingFt: null,
    summary: wmoSummary(raw, visKm, windKmh),
    humidityPct: raw.humidityPct ?? undefined,
    precipMm: raw.precipMm,
    snowfallCm: raw.snowfallCm,
    cloudCoverPct: raw.cloudCoverPct ?? undefined,
    weatherCode: raw.weatherCode ?? undefined,
    source,
    fetchedAt: new Date().toISOString(),
  };
}

export function conditionFromSpeed(speedKmh: number, elevationM: number, fallback: RoadCondition): RoadCondition {
  if (fallback === "closed") return "closed";
  if (elevationM >= 5000) return speedKmh < 20 ? "poor" : "fair";
  if (elevationM >= 4300) return speedKmh < 18 ? "poor" : speedKmh < 28 ? "fair" : "good";
  if (speedKmh < 12) return "poor";
  if (speedKmh < 22) return "fair";
  return "good";
}

export function conditionFromOsm(ways: OsmWay[], fallback: RoadCondition, speedKmh: number): RoadCondition {
  if (fallback === "closed") return "closed";
  const highway = ways.find((w) => w.highway)?.highway ?? "";
  const surface = (ways.find((w) => w.surface)?.surface ?? "").toLowerCase();
  const track = ways.find((w) => w.tracktype)?.tracktype ?? "";
  if (surface.includes("ice") || surface.includes("snow") || highway === "path") return "poor";
  if (highway === "track" || track.startsWith("grade3") || track.startsWith("grade4") || track.startsWith("grade5")) {
    return "poor";
  }
  if (surface.includes("unpaved") || surface.includes("gravel") || surface.includes("dirt") || highway === "unclassified") {
    return speedKmh < 14 ? "poor" : "fair";
  }
  if (highway === "motorway" || highway === "trunk" || highway === "primary") return "good";
  if (highway === "secondary" || highway === "tertiary") return speedKmh < 16 ? "fair" : "good";
  if (speedKmh < 11) return "poor";
  if (speedKmh < 18) return "fair";
  return fallback;
}


export function slopeFromElevations(distKm: number, samples: number[]): number {
  if (samples.length < 2 || distKm <= 0.05) return 0;
  let maxDeg = 0;
  const stepKm = distKm / (samples.length - 1);
  for (let i = 1; i < samples.length; i++) {
    const rise = Math.abs((samples[i] ?? 0) - (samples[i - 1] ?? 0));
    const run = Math.max(1, stepKm * 1000);
    const deg = (Math.atan(rise / run) * 180) / Math.PI;
    if (deg > maxDeg) maxDeg = deg;
  }
  const gain = Math.abs((samples[samples.length - 1] ?? 0) - (samples[0] ?? 0));
  const avg = (Math.atan(gain / Math.max(1, distKm * 1000)) * 180) / Math.PI;
  return clamp(Math.max(maxDeg * 0.85, avg * 2.1), 1, 28);
}

export function downsample<T>(pts: T[], max: number): T[] {
  if (pts.length <= max) return pts;
  const out: T[] = [];
  const step = (pts.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)]!);
  return out;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function airPath(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): { lat: number; lng: number }[] {
  const mid = {
    lat: (a.lat + b.lat) / 2 + (b.lng - a.lng) * 0.08,
    lng: (a.lng + b.lng) / 2 - (b.lat - a.lat) * 0.08,
  };
  return [a, mid, b];
}

export function roundCoord(n: number, digits = 4) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}
