import { clamp } from "@/lib/utils";
import type {
  Location,
  Route,
  RouteAssessment,
  ScenarioFlags,
  WeatherNow,
} from "@/types/domain";

const CONDITION = { good: 1, fair: 0.82, poor: 0.58, closed: 0.08 } as const;

export function assessRoute(args: {
  route: Route;
  from: Location;
  to: Location;
  weatherFrom: WeatherNow;
  weatherTo: WeatherNow;
  scenario: ScenarioFlags;
}): RouteAssessment {
  const { route, to, weatherTo, scenario } = args;
  const snow = clamp(
    Math.max(weatherTo.snowProb, args.weatherFrom.snowProb) +
      (scenario.snowClosure && to.elevationM >= 4600 ? 0.16 : 0),
    0,
    0.98,
  );
  let landslide = weatherTo.landslideProb;
  let condition = route.roadCondition;
  const reasons: string[] = [];

  if (scenario.routeDamaged && (route.id === "r-fob-a12" || route.id === "r-a12-b7")) {
    condition = "closed";
    landslide = clamp(landslide + 0.4, 0, 0.9);
    reasons.push("Track reported damaged — washout on north hairpin.");
  }
  if (scenario.snowClosure && route.mode !== "helicopter" && to.elevationM >= 5000) {
    if (condition !== "closed") condition = "poor";
    reasons.push("Snow closure window on high passes.");
  }
  if (route.mode === "helicopter") {
    if (weatherTo.ceilingFt != null && weatherTo.ceilingFt < 1200) {
      reasons.push("Low ceiling at LZ — abort risk.");
    } else if (weatherTo.ceilingFt == null && weatherTo.visibilityKm < 2.5) {
      reasons.push("Low visibility at LZ — abort risk.");
    }
  }

  const conditionF = CONDITION[condition];
  const slopeF = 1 - clamp(route.slopeDeg / 50, 0, 0.45);
  const elevF = 1 - clamp((to.elevationM - 3000) / 8000, 0, 0.25);
  const weatherF = 1 - snow * (route.mode === "helicopter" ? 0.38 : 0.55);
  const slideF = 1 - landslide * (route.mode === "helicopter" ? 0.05 : 0.42);
  const visF = clamp(weatherTo.visibilityKm / 8, 0.25, 1);
  const modeF =
    route.mode === "helicopter" ? 0.92 : route.mode === "road" ? 0.9 : route.mode === "cross_level" ? 0.78 : 0.7;

  let confidence = 100 * conditionF * slopeF * elevF * weatherF * slideF * visF * modeF;
  const closed = condition === "closed" || (route.mode !== "helicopter" && snow > 0.9 && to.elevationM > 5200);
  if (closed) confidence = Math.min(confidence, 8);

  const hours =
    (route.distanceKm / Math.max(4, route.baseSpeedKmh)) *
    (2 - conditionF) *
    (1 + route.slopeDeg / 40) *
    (1 + snow * (route.mode === "helicopter" ? 0.35 : 1.15));
  const extra = scenario.routeDamaged && route.id === "r-fob-a12" ? 28 : 0;
  const meanDays = (hours + extra) / 24;
  const p90Days = meanDays * (1.35 + snow * 0.55);

  if (snow > 0.5 && route.mode !== "helicopter") reasons.push(`Snow probability ${Math.round(snow * 100)}%.`);
  if (route.bridgeLoadT !== null && route.bridgeLoadT < 14) reasons.push("Bridge load restriction.");

  return {
    route,
    confidence: clamp(confidence, 2, 96) / 100,
    meanDays,
    p90Days,
    snowProb: snow,
    landslideProb: landslide,
    closed,
    reasons,
  };
}
