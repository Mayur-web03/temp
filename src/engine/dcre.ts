import { FOCUS } from "@/data/catalog";
import { inventoryRisk } from "@/engine/inventory";
import { deliveryConfidence } from "@/ml/deliveryConfidence/model";
import { forecastDemand } from "@/ml/forecasting/model";
import { assessRoute } from "@/ml/routeRisk/predict";
import { recommend } from "@/optimization/resupplyOptimizer";
import { runMonteCarlo } from "@/simulation/monteCarlo";
import type {
  DcreReport,
  Location,
  PostRisk,
  ResupplyOption,
  RouteAssessment,
  ScenarioFlags,
  Unit,
  WeatherNow,
  WorldSnapshot,
} from "@/types/domain";

function indexBy<T extends { id: string }>(rows: T[]) {
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

function weatherMap(world: WorldSnapshot) {
  return Object.fromEntries(world.weather.map((w) => [w.locationId, w]));
}

function locOf(world: WorldSnapshot, unit: Unit): Location {
  return world.locations.find((l) => l.id === unit.locationId)!;
}

function stockOf(world: WorldSnapshot, unitId: string, itemId: string) {
  return world.stock.find((s) => s.unitId === unitId && s.itemId === itemId)!;
}

function recentOf(world: WorldSnapshot, unitId: string, itemId: string) {
  return world.consumption.find((c) => c.unitId === unitId && c.itemId === itemId)?.daily;
}


function assessAllRoutes(world: WorldSnapshot, scenario: ScenarioFlags) {
  const loc = indexBy(world.locations);
  const wx = weatherMap(world);
  return world.routes.map((route) =>
    assessRoute({
      route,
      from: loc[route.fromLocationId]!,
      to: loc[route.toLocationId]!,
      weatherFrom: wx[route.fromLocationId]!,
      weatherTo: wx[route.toLocationId]!,
      scenario,
    }),
  );
}

function optionFrom(
  kind: ResupplyOption["kind"],
  label: string,
  from: Unit,
  to: Unit,
  itemId: string,
  qty: number,
  assessed: RouteAssessment,
  dc: ReturnType<typeof deliveryConfidence>,
  cost: number,
  feasible: boolean,
  blockedReason?: string,
): ResupplyOption {
  return {
    id: `${kind}-${from.id}-${to.id}-${itemId}`,
    kind,
    label,
    fromUnitId: from.id,
    toUnitId: to.id,
    itemId,
    qty,
    routeIds: [assessed.route.id],
    mode: assessed.route.mode,
    deliveryConfidence: dc.confidence,
    stockoutIfChosen: dc.stockout,
    meanDays: dc.meanDays,
    p90Days: dc.p90Days,
    cost,
    feasible,
    blockedReason,
  };
}

export function runDcre(
  world: WorldSnapshot,
  scenario: ScenarioFlags,
  focus?: { unitId: string; itemId: string },
): DcreReport {
  const unitId = focus?.unitId ?? FOCUS.unitId;
  const itemId = focus?.itemId ?? FOCUS.itemId;
  const units = indexBy(world.units);
  const items = indexBy(world.items);
  const wx = weatherMap(world);
  const routes = assessAllRoutes(world, scenario);

  const unit = units[unitId]!;
  const item = items[itemId]!;
  const location = locOf(world, unit);
  const weather = wx[location.id]!;
  const stock = stockOf(world, unitId, itemId);
  const forecast = forecastDemand({ unit, item, location, weather, scenario, recentDaily: recentOf(world, unitId, itemId) });
  const inventory = inventoryRisk(stock, forecast);

  const destRoutes = routes.filter((r) => r.route.toLocationId === location.id);
  const road = destRoutes.find((r) => r.route.mode === "track" || r.route.mode === "road");
  const heli = destRoutes.find((r) => r.route.mode === "helicopter");
  const cross = destRoutes.find((r) => r.route.mode === "cross_level");

  const fob = world.units.find((u) => u.echelon === "fob")!;
  const depot = world.units.find((u) => u.echelon === "depot")!;
  const bravo = world.units.find((u) => u.id === "u-b7")!;
  const need = Math.max(0, Math.round(forecast.p50 * 10 - stock.onHand));

  const options: ResupplyOption[] = [];

  if (road) {
    const dc = deliveryConfidence({
      onHand: stock.onHand,
      forecast,
      route: road,
      available: !road.closed,
    });
    options.push(
      optionFrom(
        "road",
        `Road · ${road.route.name}`,
        fob,
        unit,
        itemId,
        Math.min(need || 400, road.route.capacity),
        road,
        dc,
        0.22,
        !road.closed,
        road.closed ? "Track closed" : undefined,
      ),
    );
  }

  if (heli) {
    const lzOk = location.helipad && !heli.closed;
    const tasked = scenario.helicopterAvailable && lzOk;
    const dc = deliveryConfidence({
      onHand: stock.onHand,
      forecast,
      route: heli,
      available: lzOk,
      abortProb: 1 - heli.confidence,
    });
    options.push(
      optionFrom(
        "helicopter",
        "Helicopter · FOB Nubra lift",
        fob,
        unit,
        itemId,
        Math.min(150, heli.route.capacity),
        heli,
        dc,
        0.78,
        tasked,
        !scenario.helicopterAvailable
          ? "No airframe tasked"
          : !location.helipad
            ? "No LZ"
            : heli.closed
              ? "Air abort"
              : undefined,
      ),
    );
  }

  if (cross) {
    const donorStock = stockOf(world, bravo.id, itemId);
    const open = !cross.closed && donorStock.onHand > 400;
    const authorised = scenario.crossLevelStock && open;
    const dc = deliveryConfidence({
      onHand: stock.onHand,
      forecast,
      route: cross,
      available: open,
    });
    options.push(
      optionFrom(
        "cross_level",
        "Cross-level · BRAVO-7 surplus",
        bravo,
        unit,
        itemId,
        Math.min(180, Math.max(0, donorStock.onHand - 400)),
        cross,
        dc,
        0.36,
        authorised,
        !scenario.crossLevelStock
          ? "Cross-level not authorised"
          : cross.closed
            ? "Ridge track closed"
            : undefined,
      ),
    );
  }

  const alt = routes.find((r) => r.route.id === "r-fob-c4");
  if (alt && road) {
    const longer: RouteAssessment = {
      ...alt,
      meanDays: alt.meanDays + road.meanDays * 0.55,
      p90Days: alt.p90Days + road.p90Days * 0.55,
      confidence: alt.confidence * 0.72,
    };
    const dc = deliveryConfidence({
      onHand: stock.onHand,
      forecast,
      route: longer,
      available: !alt.closed && !road.closed,
    });
    options.push(
      optionFrom(
        "alternate_route",
        "Alternate · via CHARLIE-4",
        fob,
        unit,
        itemId,
        280,
        longer,
        dc,
        0.4,
        !alt.closed && !scenario.routeDamaged,
        scenario.routeDamaged ? "Hairpin still blocks final leg" : undefined,
      ),
    );
  }

  const depotRoad = routes.find((r) => r.route.id === "r-depot-fob");
  if (depotRoad && road) {
    const pre: RouteAssessment = {
      ...depotRoad,
      meanDays: depotRoad.meanDays + 1.1,
      p90Days: depotRoad.p90Days + 1.8,
      confidence: depotRoad.confidence * 0.9,
    };
    const dc = deliveryConfidence({
      onHand: stock.onHand,
      forecast,
      route: pre,
      available: true,
    });
    options.push(
      optionFrom("pre_position", "Pre-position at FOB Nubra", depot, unit, itemId, 600, pre, dc, 0.3, true),
    );
  }

  const bestRoad = options.find((o) => o.kind === "road");
  const recommendation = recommend({
    options,
    daysOfStock: inventory.daysOfStockP50,
    p90DaysRoad: bestRoad?.p90Days ?? road?.p90Days ?? 5,
    snowProb: weather.snowProb + (scenario.snowClosure ? 0.12 : 0),
    routeConfidence: road?.confidence ?? 0.3,
  });

  const chosen = recommendation.options[0] ?? bestRoad;
  const monteCarlo = runMonteCarlo({
    onHand: stock.onHand,
    p10: forecast.p10,
    p50: forecast.p50,
    p90: forecast.p90,
    meanDays: chosen?.meanDays ?? 4,
    p90Days: chosen?.p90Days ?? 6,
    abortProb: chosen && !chosen.feasible ? 0.85 : chosen?.kind === "helicopter" ? 0.18 : 0.08,
    samples: 900,
    seed: 4411,
  });

  const posts: PostRisk[] = world.units
    .filter((u) => u.echelon === "post")
    .map((u) => {
      const loc = locOf(world, u);
      const w = wx[loc.id]!;
      let worstInv = inventoryRisk(stockOf(world, u.id, itemId), forecastDemand({ unit: u, item, location: loc, weather: w, scenario, recentDaily: recentOf(world, u.id, itemId) }));
      let worstItem = item;
      for (const it of world.items) {
        const f = forecastDemand({ unit: u, item: it, location: loc, weather: w, scenario, recentDaily: recentOf(world, u.id, it.id) });
        const inv = inventoryRisk(stockOf(world, u.id, it.id), f);
        const score = inv.stockoutRisk * it.criticality;
        if (score > worstInv.stockoutRisk * worstItem.criticality) {
          worstInv = inv;
          worstItem = it;
        }
      }
      const incoming = destRoutesFor(routes, loc.id);
      const best = incoming
        .map((r) =>
          deliveryConfidence({
            onHand: worstInv.onHand,
            forecast: forecastDemand({ unit: u, item: worstItem, location: loc, weather: w, scenario, recentDaily: recentOf(world, u.id, worstItem.id) }),
            route: r,
            available: r.route.mode !== "helicopter" || scenario.helicopterAvailable,
          }),
        )
        .sort((a, b) => b.confidence - a.confidence)[0];
      const readiness: PostRisk["readiness"] =
        worstInv.stockoutRisk >= 0.62 ? "critical" : worstInv.stockoutRisk >= 0.32 ? "degraded" : "ready";
      return {
        unit: u,
        location: loc,
        worst: worstInv,
        item: worstItem,
        deliveryConfidence: best?.confidence ?? 0.4,
        readiness,
      };
    })
    .sort((a, b) => b.worst.stockoutRisk - a.worst.stockoutRisk);

  const criticalItems = posts.filter((p) => p.worst.stockoutRisk >= 0.45).length;
  const top = posts[0];
  const readiness: DcreReport["kpis"]["readiness"] =
    top && top.worst.stockoutRisk >= 0.62 ? "critical" : top && top.worst.stockoutRisk >= 0.32 ? "degraded" : "ready";
  const activeShipments = world.shipments.filter((s) => s.status === "enroute" || s.status === "held" || s.status === "planned").length;

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      stockoutRisk: inventory.stockoutRisk,
      deliveryConfidence: bestRoad?.deliveryConfidence ?? recommendation.expectedDeliveryConfidence,
      criticalItems,
      activeShipments,
      readiness,
    },
    posts,
    focus: {
      unit,
      item,
      inventory,
      forecast,
      options,
      recommendation,
      monteCarlo,
    },
  };
}

function destRoutesFor(routes: RouteAssessment[], locationId: string) {
  return routes.filter((r) => r.route.toLocationId === locationId);
}

export function runDcreWithPlan(world: WorldSnapshot, scenario: ScenarioFlags): { before: DcreReport; after: DcreReport } {
  const before = runDcre(world, scenario);
  const afterFlags: ScenarioFlags = {
    ...scenario,
    helicopterAvailable: true,
    crossLevelStock: true,
  };
  const after = runDcre(world, afterFlags);
  return { before, after };
}
