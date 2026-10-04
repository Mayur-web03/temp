import { ITEMS, LOCATIONS, ROUTES, SECTOR, UNITS } from "@/data/catalog";
import { mulberry32 } from "@/lib/utils";
import type {
  ConsumptionSeries,
  IotReading,
  Shipment,
  StockLevel,
  WeatherNow,
  WorldSnapshot,
} from "@/types/domain";

const TODAY = "2026-10-03";

function isoDaysAgo(n: number) {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function weatherFor(locationId: string, elevationM: number): WeatherNow {
  const high = elevationM >= 5000;
  const mid = elevationM >= 4500;
  if (locationId === "loc-a12") {
    return {
      locationId,
      tempC: -18,
      windKmh: 42,
      visibilityKm: 1.4,
      snowProb: 0.78,
      landslideProb: 0.22,
      ceilingFt: 900,
      summary: "Snow band over the ridge. Ceiling collapsing after 1600h.",
    };
  }
  if (locationId === "loc-d9") {
    return {
      locationId,
      tempC: -14,
      windKmh: 28,
      visibilityKm: 3.2,
      snowProb: 0.54,
      landslideProb: 0.18,
      ceilingFt: 1400,
      summary: "Scattered snow. Track icing on north face.",
    };
  }
  if (high) {
    return {
      locationId,
      tempC: -11,
      windKmh: 22,
      visibilityKm: 5,
      snowProb: 0.36,
      landslideProb: 0.12,
      ceilingFt: 2200,
      summary: "Cold, gusty, passable with caution.",
    };
  }
  if (mid) {
    return {
      locationId,
      tempC: -6,
      windKmh: 16,
      visibilityKm: 8,
      snowProb: 0.18,
      landslideProb: 0.08,
      ceilingFt: 3500,
      summary: "Broken cloud. Tracks open.",
    };
  }
  return {
    locationId,
    tempC: 2,
    windKmh: 12,
    visibilityKm: 12,
    snowProb: 0.06,
    landslideProb: 0.04,
    ceilingFt: 6000,
    summary: "Clear valley. Full MSRs open.",
  };
}

/** Hand-tuned on-hand so ALPHA-12 ECC sits at ~3.5 days and BRAVO holds surplus. */
const STOCK_OVERRIDES: Record<string, number> = {
  "u-a12:i-ecc": 210,
  "u-a12:i-ration": 2800,
  "u-a12:i-plasma": 48,
  "u-a12:i-atgm": 28,
  "u-a12:i-556": 18000,
  "u-a12:i-trauma": 90,
  "u-a12:i-hsd": 2200,
  "u-a12:i-water": 900,
  "u-b7:i-ecc": 1460,
  "u-b7:i-ration": 2200,
  "u-b7:i-trauma": 140,
  "u-d9:i-ecc": 620,
  "u-d9:i-hsd": 900,
  "u-c4:i-hsd": 800,
  "u-c4:i-plasma": 40,
  "u-e3:i-ecc": 890,
  "u-e3:i-gen": 40,
  "u-e3:i-ration": 1400,
  "u-fob:i-ecc": 4200,
  "u-fob:i-ration": 8600,
  "u-fob:i-plasma": 96,
  "u-depot:i-ecc": 18000,
  "u-depot:i-ration": 42000,
};

function defaultOnHand(unitId: string, item: (typeof ITEMS)[number], troops: number) {
  const key = `${unitId}:${item.id}`;
  if (key in STOCK_OVERRIDES) return STOCK_OVERRIDES[key]!;
  const days = unitId === "u-depot" ? 45 : unitId === "u-fob" ? 22 : 11;
  return Math.round(troops * item.basePerPersonPerDay * days * (0.85 + item.criticality * 0.2));
}

function buildStock(): StockLevel[] {
  const troops = Object.fromEntries(UNITS.map((u) => [u.id, u.troopStrength]));
  const rows: StockLevel[] = [];
  for (const unit of UNITS) {
    for (const item of ITEMS) {
      rows.push({
        unitId: unit.id,
        itemId: item.id,
        onHand: defaultOnHand(unit.id, item, troops[unit.id] ?? 80),
        safetyDays: item.criticality > 0.9 ? 7 : 5,
      });
    }
  }
  return rows;
}

function buildConsumption(stock: StockLevel[]): ConsumptionSeries[] {
  const rng = mulberry32(20261003);
  const locById = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));
  const unitById = Object.fromEntries(UNITS.map((u) => [u.id, u]));
  const itemById = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
  return stock.map((s) => {
    const unit = unitById[s.unitId]!;
    const item = itemById[s.itemId]!;
    const loc = locById[unit.locationId]!;
    const mission = unit.mission === "high" ? 1.45 : unit.mission === "medium" ? 1.12 : 0.9;
    const alt = 1 + Math.max(0, loc.elevationM - 3000) / 4200;
    const p50 = unit.troopStrength * item.basePerPersonPerDay * mission * alt;
    const daily: number[] = [];
    for (let i = 0; i < 90; i++) {
      const seasonal = 1 + 0.1 * Math.sin(((i + 250) / 365) * Math.PI * 2);
      const noise = 0.78 + rng() * 0.48;
      daily.push(Math.max(1, Math.round(p50 * seasonal * noise)));
    }
    return {
      unitId: s.unitId,
      itemId: s.itemId,
      startDate: isoDaysAgo(89),
      daily,
    };
  });
}

function buildShipments(): Shipment[] {
  return [
    {
      id: "sh-441",
      originUnitId: "u-fob",
      destUnitId: "u-a12",
      itemId: "i-ration",
      qty: 220,
      mode: "track",
      routeId: "r-fob-a12",
      status: "held",
      departedAt: null,
      etaAt: "2026-10-08T06:00:00Z",
      confidence: 0.31,
    },
    {
      id: "sh-438",
      originUnitId: "u-depot",
      destUnitId: "u-fob",
      itemId: "i-ecc",
      qty: 600,
      mode: "road",
      routeId: "r-depot-fob",
      status: "enroute",
      departedAt: "2026-10-02T04:10:00Z",
      etaAt: "2026-10-04T18:00:00Z",
      confidence: 0.88,
    },
    {
      id: "sh-436",
      originUnitId: "u-fob",
      destUnitId: "u-c4",
      itemId: "i-hsd",
      qty: 800,
      mode: "track",
      routeId: "r-fob-c4",
      status: "enroute",
      departedAt: "2026-10-03T01:40:00Z",
      etaAt: "2026-10-04T11:00:00Z",
      confidence: 0.74,
    },
    {
      id: "sh-429",
      originUnitId: "u-fob",
      destUnitId: "u-e3",
      itemId: "i-556",
      qty: 4000,
      mode: "track",
      routeId: "r-fob-e3",
      status: "delivered",
      departedAt: "2026-10-01T07:00:00Z",
      etaAt: "2026-10-02T16:00:00Z",
      confidence: 0.91,
    },
    {
      id: "sh-442",
      originUnitId: "u-fob",
      destUnitId: "u-d9",
      itemId: "i-plasma",
      qty: 12,
      mode: "helicopter",
      routeId: "h-fob-d9",
      status: "planned",
      departedAt: null,
      etaAt: "2026-10-03T21:00:00Z",
      confidence: 0.62,
    },
  ];
}

function buildIot(): IotReading[] {
  return [
    {
      id: "iot-a12-ecc",
      kind: "stock",
      unitId: "u-a12",
      itemId: "i-ecc",
      label: "ALPHA-12 ECC cage",
      value: 280,
      unit: "sets",
      updatedAt: "2026-10-03T10:42:00Z",
      ok: true,
    },
    {
      id: "iot-a12-temp",
      kind: "temp",
      unitId: "u-a12",
      itemId: "i-plasma",
      label: "ALPHA-12 plasma fridge",
      value: 3.8,
      unit: "°C",
      updatedAt: "2026-10-03T10:44:00Z",
      ok: true,
    },
    {
      id: "iot-c4-temp",
      kind: "temp",
      unitId: "u-c4",
      itemId: "i-plasma",
      label: "CHARLIE-4 plasma fridge",
      value: 8.6,
      unit: "°C",
      updatedAt: "2026-10-03T10:41:00Z",
      ok: false,
    },
    {
      id: "iot-sh438",
      kind: "gps",
      shipmentId: "sh-438",
      label: "Convoy SH-438",
      value: 34.31,
      unit: "lat",
      updatedAt: "2026-10-03T10:40:00Z",
      ok: true,
    },
    {
      id: "iot-a12-gate",
      kind: "gate",
      unitId: "u-a12",
      label: "ALPHA-12 weather gate",
      value: 0,
      unit: "open",
      updatedAt: "2026-10-03T10:30:00Z",
      ok: false,
    },
  ];
}

export function buildSeedWorld(): WorldSnapshot {
  const stock = buildStock();
  return {
    generatedAt: `${TODAY}T11:00:00Z`,
    sector: SECTOR,
    locations: LOCATIONS,
    units: UNITS,
    items: ITEMS,
    stock,
    consumption: buildConsumption(stock),
    routes: ROUTES,
    weather: LOCATIONS.map((l) => weatherFor(l.id, l.elevationM)),
    shipments: buildShipments(),
    iot: buildIot(),
    source: "local",
  };
}

export const DEFAULT_SCENARIO = {
  snowClosure: true,
  helicopterAvailable: true,
  routeDamaged: false,
  crossLevelStock: false,
};
