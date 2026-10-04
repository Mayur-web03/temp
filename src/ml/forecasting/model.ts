import { clamp, mean } from "@/lib/utils";
import type {
  Item,
  Location,
  QuantileForecast,
  ScenarioFlags,
  Unit,
  WeatherNow,
} from "@/types/domain";

const MISSION = { low: 0.9, medium: 1.12, high: 1.45 } as const;

export function forecastDemand(args: {
  unit: Unit;
  item: Item;
  location: Location;
  weather: WeatherNow;
  scenario: ScenarioFlags;
  recentDaily?: number[];
}): QuantileForecast {
  const { unit, item, location, weather, scenario } = args;
  const snow = clamp(
    weather.snowProb + (scenario.snowClosure && location.elevationM >= 4800 ? 0.18 : 0),
    0,
    0.97,
  );
  const altitude = 1 + Math.max(0, location.elevationM - 3000) / 4200;
  const weatherMult =
    1 +
    snow * (item.category === "clothing" || item.category === "fuel" ? 0.42 : 0.18) +
    Math.max(0, -weather.tempC - 8) * 0.012;
  const mission = MISSION[unit.mission];
  const cold =
    item.category === "clothing" ? 1 + Math.max(0, location.elevationM - 4000) / 2800 : 1;

  let p50 = unit.troopStrength * item.basePerPersonPerDay * altitude * weatherMult * mission * cold;
  const hist = args.recentDaily && args.recentDaily.length >= 7 ? mean(args.recentDaily.slice(-14)) : null;
  if (hist && hist > 0) p50 = p50 * 0.7 + hist * 0.3;
  const p10 = p50 * 0.72;
  const p90 = p50 * (1.34 + snow * 0.22);

  return {
    unitId: unit.id,
    itemId: item.id,
    p10,
    p50,
    p90,
    drivers: [
      { name: "Troop strength", multiplier: unit.troopStrength },
      { name: "Altitude", multiplier: altitude },
      { name: "Weather / snow", multiplier: weatherMult },
      { name: "Mission activity", multiplier: mission },
      ...(hist ? [{ name: "90-day consumption", multiplier: hist / Math.max(p50, 0.01) }] : []),
    ],
  };
}
