import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clearSupabaseKeys, readSupabaseKeys } from "@/api/keys";
import { buildSeedWorld } from "@/data/seed";
import type {
  ConsumptionSeries,
  Item,
  Location,
  Route,
  Shipment,
  StockLevel,
  Unit,
  WorldSnapshot,
} from "@/types/domain";

const OPS_KEY = "senasetu.ops.v1";

export function supabaseEnv() {
  const keys = readSupabaseKeys();
  if (!keys) return null;
  return { url: keys.url, key: keys.anonKey, origin: keys.origin };
}

let client: SupabaseClient | null | undefined;
let clientUrl: string | null = null;

export function resetSupabase() {
  client = undefined;
  clientUrl = null;
}

export function getSupabase(): SupabaseClient | null {
  const env = supabaseEnv();
  if (!env) {
    client = null;
    clientUrl = null;
    return null;
  }
  if (client && clientUrl === env.url) return client;
  client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clientUrl = env.url;
  return client;
}

function asArray<T>(data: T[] | null | undefined): T[] {
  return Array.isArray(data) ? data : [];
}

type LocRow = {
  id: string;
  name: string;
  code: string;
  kind: Location["kind"];
  lat: number;
  lng: number;
  elevation_m: number;
  helipad: boolean;
};

type UnitRow = {
  id: string;
  callsign: string;
  location_id: string;
  echelon: Unit["echelon"];
  troop_strength: number;
  mission: Unit["mission"];
  commander: string;
};

type ItemRow = {
  id: string;
  name: string;
  short: string;
  category: Item["category"];
  unit: string;
  cold_chain: boolean;
  base_per_person_per_day: number;
  criticality: number;
};

type StockRow = {
  unit_id: string;
  item_id: string;
  on_hand: number;
  safety_days: number;
};

type RouteRow = {
  id: string;
  name: string;
  from_location_id: string;
  to_location_id: string;
  mode: Route["mode"];
  distance_km: number;
  slope_deg: number;
  road_condition: Route["roadCondition"];
  bridge_load_t: number | null;
  path: { lat: number; lng: number }[];
  base_speed_kmh: number;
  capacity: number;
  duration_min?: number | null;
  elevation_gain_m?: number | null;
  highway?: string | null;
  surface?: string | null;
  road_name?: string | null;
  source?: Route["source"] | null;
};

type ShipRow = {
  id: string;
  origin_unit_id: string;
  dest_unit_id: string;
  item_id: string;
  qty: number;
  mode: Shipment["mode"];
  route_id: string;
  status: Shipment["status"];
  departed_at: string | null;
  eta_at: string;
  confidence: number;
};

type ConsRow = { unit_id: string; item_id: string; day: string; qty: number };

export function locationFromRow(r: LocRow): Location {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    kind: r.kind,
    point: { lat: Number(r.lat), lng: Number(r.lng) },
    elevationM: Number(r.elevation_m),
    helipad: Boolean(r.helipad),
  };
}

export function locationToRow(l: Location): LocRow {
  return {
    id: l.id,
    name: l.name,
    code: l.code,
    kind: l.kind,
    lat: l.point.lat,
    lng: l.point.lng,
    elevation_m: Math.round(l.elevationM),
    helipad: l.helipad,
  };
}

function unitFromRow(r: UnitRow): Unit {
  return {
    id: r.id,
    callsign: r.callsign,
    locationId: r.location_id,
    echelon: r.echelon,
    troopStrength: Number(r.troop_strength),
    mission: r.mission,
    commander: r.commander,
  };
}

function itemFromRow(r: ItemRow): Item {
  return {
    id: r.id,
    name: r.name,
    short: r.short,
    category: r.category,
    unit: r.unit,
    coldChain: Boolean(r.cold_chain),
    basePerPersonPerDay: Number(r.base_per_person_per_day),
    criticality: Number(r.criticality),
  };
}

function stockFromRow(r: StockRow): StockLevel {
  return {
    unitId: r.unit_id,
    itemId: r.item_id,
    onHand: Number(r.on_hand),
    safetyDays: Number(r.safety_days),
  };
}

function routeFromRow(r: RouteRow): Route {
  return {
    id: r.id,
    name: r.name,
    fromLocationId: r.from_location_id,
    toLocationId: r.to_location_id,
    mode: r.mode,
    distanceKm: Number(r.distance_km),
    slopeDeg: Number(r.slope_deg),
    roadCondition: r.road_condition,
    bridgeLoadT: r.bridge_load_t,
    path: Array.isArray(r.path) ? r.path : [],
    baseSpeedKmh: Number(r.base_speed_kmh),
    capacity: Number(r.capacity),
    durationMin: r.duration_min != null ? Number(r.duration_min) : undefined,
    elevationGainM: r.elevation_gain_m != null ? Number(r.elevation_gain_m) : undefined,
    highway: r.highway ?? undefined,
    surface: r.surface ?? undefined,
    roadName: r.road_name ?? undefined,
    source: r.source ?? undefined,
  };
}

function shipFromRow(r: ShipRow): Shipment {
  return {
    id: r.id,
    originUnitId: r.origin_unit_id,
    destUnitId: r.dest_unit_id,
    itemId: r.item_id,
    qty: Number(r.qty),
    mode: r.mode,
    routeId: r.route_id,
    status: r.status,
    departedAt: r.departed_at,
    etaAt: r.eta_at,
    confidence: Number(r.confidence),
  };
}

function seriesFromEvents(rows: ConsRow[]): ConsumptionSeries[] {
  const grouped = new Map<string, ConsRow[]>();
  for (const row of rows) {
    const k = `${row.unit_id}:${row.item_id}`;
    const list = grouped.get(k) ?? [];
    list.push(row);
    grouped.set(k, list);
  }
  const out: ConsumptionSeries[] = [];
  for (const [k, list] of grouped) {
    const [unitId, itemId] = k.split(":");
    const sorted = [...list].sort((a, b) => a.day.localeCompare(b.day));
    out.push({
      unitId: unitId!,
      itemId: itemId!,
      startDate: sorted[0]?.day ?? "",
      daily: sorted.map((r) => Number(r.qty)),
    });
  }
  return out;
}

function eventsFromSeries(series: ConsumptionSeries[]): ConsRow[] {
  const rows: ConsRow[] = [];
  for (const s of series) {
    const start = new Date(`${s.startDate}T00:00:00Z`);
    s.daily.forEach((qty, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      rows.push({
        unit_id: s.unitId,
        item_id: s.itemId,
        day: d.toISOString().slice(0, 10),
        qty,
      });
    });
  }
  return rows;
}

type OpsBundle = {
  locations: Location[];
  units: Unit[];
  items: Item[];
  stock: StockLevel[];
  consumption: ConsumptionSeries[];
  routes: Route[];
  shipments: Shipment[];
  source: "local" | "supabase";
  opsDetail?: string;
};

function seedBundle(seed: WorldSnapshot, detail: string): OpsBundle {
  return {
    locations: seed.locations,
    units: seed.units,
    items: seed.items,
    stock: seed.stock,
    consumption: seed.consumption,
    routes: seed.routes,
    shipments: seed.shipments,
    source: "local",
    opsDetail: detail,
  };
}

function readLocalOps(seed: WorldSnapshot): OpsBundle | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(OPS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorldSnapshot>;
    return {
      locations: parsed.locations?.length ? parsed.locations : seed.locations,
      units: parsed.units?.length ? parsed.units : seed.units,
      items: parsed.items?.length ? parsed.items : seed.items,
      stock: parsed.stock?.length ? parsed.stock : seed.stock,
      consumption: parsed.consumption?.length ? parsed.consumption : seed.consumption,
      routes: parsed.routes?.length ? parsed.routes : seed.routes,
      shipments: parsed.shipments?.length ? parsed.shipments : seed.shipments,
      source: "local",
      opsDetail: "Indexed locally — add Supabase keys to sync",
    };
  } catch {
    return null;
  }
}

export function writeLocalOps(world: WorldSnapshot) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      OPS_KEY,
      JSON.stringify({
        locations: world.locations,
        units: world.units,
        items: world.items,
        stock: world.stock,
        consumption: world.consumption,
        routes: world.routes,
        shipments: world.shipments,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch {
    /* quota */
  }
}

async function upsertChunked(
  sb: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  extra?: { ignoreDuplicates?: boolean },
) {
  const chunk = 400;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await sb.from(table).upsert(slice, {
      onConflict,
      ignoreDuplicates: extra?.ignoreDuplicates ?? false,
    });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function pushSeed(sb: SupabaseClient, seed: WorldSnapshot) {
  await upsertChunked(sb, "locations", seed.locations.map(locationToRow), "id");
  await upsertChunked(
    sb,
    "units",
    seed.units.map((u) => ({
      id: u.id,
      callsign: u.callsign,
      location_id: u.locationId,
      echelon: u.echelon,
      troop_strength: u.troopStrength,
      mission: u.mission,
      commander: u.commander,
    })),
    "id",
  );
  await upsertChunked(
    sb,
    "items",
    seed.items.map((it) => ({
      id: it.id,
      name: it.name,
      short: it.short,
      category: it.category,
      unit: it.unit,
      cold_chain: it.coldChain,
      base_per_person_per_day: it.basePerPersonPerDay,
      criticality: it.criticality,
    })),
    "id",
  );
  await upsertChunked(
    sb,
    "stock_levels",
    seed.stock.map((s) => ({
      unit_id: s.unitId,
      item_id: s.itemId,
      on_hand: s.onHand,
      safety_days: s.safetyDays,
    })),
    "unit_id,item_id",
  );
  await upsertChunked(
    sb,
    "routes",
    seed.routes.map((r) => ({
      id: r.id,
      name: r.name,
      from_location_id: r.fromLocationId,
      to_location_id: r.toLocationId,
      mode: r.mode,
      distance_km: r.distanceKm,
      slope_deg: r.slopeDeg,
      road_condition: r.roadCondition,
      bridge_load_t: r.bridgeLoadT,
      path: r.path,
      base_speed_kmh: r.baseSpeedKmh,
      capacity: r.capacity,
      duration_min: r.durationMin ?? null,
      elevation_gain_m: r.elevationGainM ?? null,
      highway: r.highway ?? null,
      surface: r.surface ?? null,
      road_name: r.roadName ?? null,
      source: r.source ?? "seed",
    })),
    "id",
  );
  await upsertChunked(
    sb,
    "shipments",
    seed.shipments.map((s) => ({
      id: s.id,
      origin_unit_id: s.originUnitId,
      dest_unit_id: s.destUnitId,
      item_id: s.itemId,
      qty: s.qty,
      mode: s.mode,
      route_id: s.routeId,
      status: s.status,
      departed_at: s.departedAt,
      eta_at: s.etaAt,
      confidence: s.confidence,
    })),
    "id",
  );
  const events = eventsFromSeries(seed.consumption);
  if (events.length) {
    try {
      await upsertChunked(sb, "consumption_events", events, "unit_id,item_id,day", { ignoreDuplicates: true });
    } catch {
      /* unique index missing — ops still usable */
    }
  }
}

function coalesce<T>(rows: T[] | undefined, fallback: T[]): T[] {
  return rows && rows.length ? rows : fallback;
}

async function pullSupabase(sb: SupabaseClient, seed: WorldSnapshot): Promise<OpsBundle> {
  const [locations, units, items, stock, routes, shipments, consumption] = await Promise.all([
    sb.from("locations").select("*"),
    sb.from("units").select("*"),
    sb.from("items").select("*"),
    sb.from("stock_levels").select("*"),
    sb.from("routes").select("*"),
    sb.from("shipments").select("*"),
    sb.from("consumption_events").select("*"),
  ]);

  const hard =
    locations.error?.message ||
    units.error?.message ||
    items.error?.message ||
    stock.error?.message ||
    routes.error?.message ||
    shipments.error?.message;

  if (hard) {
    throw new Error(hard);
  }

  const locRows = asArray(locations.data as LocRow[] | null);
  if (locRows.length === 0) {
    await pushSeed(sb, seed);
    return {
      locations: seed.locations,
      units: seed.units,
      items: seed.items,
      stock: seed.stock,
      consumption: seed.consumption,
      routes: seed.routes,
      shipments: seed.shipments,
      source: "supabase",
      opsDetail: "Empty project seeded from the training picture",
    };
  }

  const consRows = asArray(consumption.data as ConsRow[] | null);
  return {
    locations: coalesce(locRows.map(locationFromRow), seed.locations),
    units: coalesce(asArray(units.data as UnitRow[] | null).map(unitFromRow), seed.units),
    items: coalesce(asArray(items.data as ItemRow[] | null).map(itemFromRow), seed.items),
    stock: coalesce(asArray(stock.data as StockRow[] | null).map(stockFromRow), seed.stock),
    consumption: consRows.length ? seriesFromEvents(consRows) : seed.consumption,
    routes: coalesce(asArray(routes.data as RouteRow[] | null).map(routeFromRow), seed.routes),
    shipments: coalesce(asArray(shipments.data as ShipRow[] | null).map(shipFromRow), seed.shipments),
    source: "supabase",
    opsDetail: "Operational tables",
  };
}

export async function loadOps(): Promise<OpsBundle> {
  const seed = buildSeedWorld();
  const sb = getSupabase();
  if (sb) {
    try {
      return await pullSupabase(sb, seed);
    } catch (err) {
      const local = readLocalOps(seed);
      const hint =
        err instanceof Error && /relation|schema cache|does not exist/i.test(err.message)
          ? "Paste database/schema.sql into the Supabase SQL editor, then refresh."
          : err instanceof Error
            ? err.message
            : "error";
      return {
        ...(local ?? seedBundle(seed, hint)),
        source: "local",
        opsDetail: `Supabase unavailable (${hint}). Using local ops.`,
      };
    }
  }
  return readLocalOps(seed) ?? seedBundle(seed, "No Supabase keys — local training picture");
}

export async function cacheFeedPayload(cacheKey: string, payload: unknown) {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("feed_cache").upsert(
      { cache_key: cacheKey, payload, fetched_at: new Date().toISOString() },
      { onConflict: "cache_key" },
    );
  } catch {
    /* optional table */
  }
}

export async function readFeedPayload<T>(cacheKey: string): Promise<T | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.from("feed_cache").select("payload, fetched_at").eq("cache_key", cacheKey).maybeSingle();
    if (!data) return null;
    return data.payload as T;
  } catch {
    return null;
  }
}

export async function loadWorld(): Promise<WorldSnapshot> {
  const seed = buildSeedWorld();
  const ops = await loadOps();
  return {
    ...seed,
    locations: ops.locations.length ? ops.locations : seed.locations,
    units: ops.units.length ? ops.units : seed.units,
    items: ops.items.length ? ops.items : seed.items,
    stock: ops.stock.length ? ops.stock : seed.stock,
    consumption: ops.consumption.length ? ops.consumption : seed.consumption,
    routes: ops.routes.length ? ops.routes : seed.routes,
    shipments: ops.shipments.length ? ops.shipments : seed.shipments,
    source: ops.source,
  };
}

export function dropLocalKeys() {
  clearSupabaseKeys();
  resetSupabase();
}
