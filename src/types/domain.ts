export type Echelon = "depot" | "fob" | "post";
export type TransportMode = "road" | "track" | "helicopter" | "cross_level";
export type RoadCondition = "good" | "fair" | "poor" | "closed";
export type MissionActivity = "low" | "medium" | "high";
export type ItemCategory =
  | "ammo"
  | "ration"
  | "fuel"
  | "medical"
  | "clothing"
  | "power"
  | "comms"
  | "water"
  | "spares"
  | "cold_chain";

export type ActionKind =
  | "road"
  | "alternate_route"
  | "helicopter"
  | "cross_level"
  | "split_shipment"
  | "pre_position"
  | "emergency_resupply";

export type Sector = {
  id: string;
  name: string;
  code: string;
  theater: string;
};

export type GeoPoint = { lat: number; lng: number };

export type Location = {
  id: string;
  name: string;
  code: string;
  kind: Echelon;
  point: GeoPoint;
  elevationM: number;
  helipad: boolean;
};

export type Unit = {
  id: string;
  callsign: string;
  locationId: string;
  echelon: Echelon;
  troopStrength: number;
  mission: MissionActivity;
  commander: string;
};

export type Item = {
  id: string;
  name: string;
  short: string;
  category: ItemCategory;
  unit: string;
  coldChain: boolean;
  basePerPersonPerDay: number;
  criticality: number;
};

export type StockLevel = {
  unitId: string;
  itemId: string;
  onHand: number;
  safetyDays: number;
};

export type ConsumptionSeries = {
  unitId: string;
  itemId: string;
  startDate: string;
  daily: number[];
};

export type Route = {
  id: string;
  name: string;
  fromLocationId: string;
  toLocationId: string;
  mode: TransportMode;
  distanceKm: number;
  slopeDeg: number;
  roadCondition: RoadCondition;
  bridgeLoadT: number | null;
  path: GeoPoint[];
  baseSpeedKmh: number;
  capacity: number;
  durationMin?: number;
  elevationGainM?: number;
  highway?: string;
  surface?: string;
  roadName?: string;
  source?: "osrm" | "seed";
};


export type WeatherNow = {
  locationId: string;
  tempC: number;
  windKmh: number;
  visibilityKm: number;
  snowProb: number;
  landslideProb: number;
  ceilingFt: number | null;
  summary: string;
  humidityPct?: number;
  precipMm?: number;
  snowfallCm?: number;
  cloudCoverPct?: number;
  weatherCode?: number;
  source?: "open-meteo" | "met-norway" | "seed";
  fetchedAt?: string;
};


export type ShipmentStatus = "planned" | "enroute" | "held" | "delivered";

export type Shipment = {
  id: string;
  originUnitId: string;
  destUnitId: string;
  itemId: string;
  qty: number;
  mode: TransportMode;
  routeId: string;
  status: ShipmentStatus;
  departedAt: string | null;
  etaAt: string;
  confidence: number;
};

export type IotReading = {
  id: string;
  kind: "stock" | "temp" | "gps" | "gate";
  unitId?: string;
  shipmentId?: string;
  itemId?: string;
  label: string;
  value: number;
  unit: string;
  updatedAt: string;
  ok: boolean;
};

export type ScenarioFlags = {
  snowClosure: boolean;
  helicopterAvailable: boolean;
  routeDamaged: boolean;
  crossLevelStock: boolean;
};

export type QuantileForecast = {
  unitId: string;
  itemId: string;
  p10: number;
  p50: number;
  p90: number;
  drivers: { name: string; multiplier: number }[];
};

export type InventoryRisk = {
  unitId: string;
  itemId: string;
  onHand: number;
  daysOfStockP50: number;
  daysOfStockP90: number;
  stockoutRisk: number;
};

export type RouteAssessment = {
  route: Route;
  confidence: number;
  meanDays: number;
  p90Days: number;
  snowProb: number;
  landslideProb: number;
  closed: boolean;
  reasons: string[];
};

export type ResupplyOption = {
  id: string;
  kind: ActionKind;
  label: string;
  fromUnitId: string;
  toUnitId: string;
  itemId: string;
  qty: number;
  routeIds: string[];
  mode: TransportMode;
  deliveryConfidence: number;
  stockoutIfChosen: number;
  meanDays: number;
  p90Days: number;
  cost: number;
  feasible: boolean;
  blockedReason?: string;
};

export type Factor = {
  factor: string;
  effect: "helps" | "hurts";
  weight: number;
  detail: string;
};

export type Recommendation = {
  id: string;
  title: string;
  summary: string;
  primary: ActionKind;
  options: ResupplyOption[];
  expectedDeliveryConfidence: number;
  expectedStockoutRisk: number;
  why: Factor[];
};

export type HistogramBin = { x0: number; x1: number; n: number };

export type MonteCarloResult = {
  samples: number;
  pStockout: number;
  pArriveBeforeStockout: number;
  meanDaysRemaining: number;
  p90DeliveryDays: number;
  remainingStock: HistogramBin[];
};

export type PostRisk = {
  unit: Unit;
  location: Location;
  worst: InventoryRisk;
  item: Item;
  deliveryConfidence: number;
  readiness: "ready" | "degraded" | "critical";
};

export type DcreReport = {
  generatedAt: string;
  kpis: {
    stockoutRisk: number;
    deliveryConfidence: number;
    criticalItems: number;
    activeShipments: number;
    readiness: "ready" | "degraded" | "critical";
  };
  posts: PostRisk[];
  focus: {
    unit: Unit;
    item: Item;
    inventory: InventoryRisk;
    forecast: QuantileForecast;
    options: ResupplyOption[];
    recommendation: Recommendation;
    monteCarlo: MonteCarloResult;
  };
};

export type SimBeforeAfter = {
  before: DcreReport;
  after: DcreReport;
  applied: ScenarioFlags;
};

export type WorldSnapshot = {
  generatedAt: string;
  sector: Sector;
  locations: Location[];
  units: Unit[];
  items: Item[];
  stock: StockLevel[];
  consumption: ConsumptionSeries[];
  routes: Route[];
  weather: WeatherNow[];
  shipments: Shipment[];
  iot: IotReading[];
  source: "local" | "supabase";
  feeds?: import("@/api/types").DataFeeds;
  weatherHistory?: import("@/api/types").WeatherHistoryDay[];
};

