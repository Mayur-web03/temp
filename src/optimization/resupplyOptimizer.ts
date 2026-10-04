import { rankOptions } from "@/optimization/scoring";
import type { Factor, Recommendation, ResupplyOption } from "@/types/domain";

function blend(a: ResupplyOption, b: ResupplyOption, qtyA: number, qtyB: number): ResupplyOption {
  const t = qtyA / Math.max(1, qtyA + qtyB);
  return {
    id: `split-${a.id}-${b.id}`,
    kind: "split_shipment",
    label: `Split · ${a.label.split("·")[0]?.trim()} + ${b.label.split("·")[0]?.trim()}`,
    fromUnitId: a.fromUnitId,
    toUnitId: a.toUnitId,
    itemId: a.itemId,
    qty: qtyA + qtyB,
    routeIds: [...a.routeIds, ...b.routeIds],
    mode: a.mode,
    deliveryConfidence: Math.min(0.96, a.deliveryConfidence * t + b.deliveryConfidence * (1 - t) + 0.06),
    stockoutIfChosen: Math.max(0.04, a.stockoutIfChosen * t * 0.5 + b.stockoutIfChosen * (1 - t) * 0.5),
    meanDays: Math.max(a.meanDays, b.meanDays) * 0.7,
    p90Days: Math.max(a.p90Days, b.p90Days) * 0.75,
    cost: (a.cost + b.cost) / 2,
    feasible: true,
  };
}

export function recommend(args: {
  options: ResupplyOption[];
  daysOfStock: number;
  p90DaysRoad: number;
  snowProb: number;
  routeConfidence: number;
}): Recommendation {
  const heli = args.options.find((o) => o.kind === "helicopter" && !o.blockedReason?.includes("No LZ"));
  const cross = args.options.find((o) => o.kind === "cross_level" && !o.blockedReason?.includes("closed"));
  const road = args.options.find((o) => o.kind === "road" || o.kind === "alternate_route");
  const lastMile = args.options.filter((o) => o.kind !== "pre_position");
  const ranked = rankOptions(lastMile);

  let primary = ranked[0];
  const pack: ResupplyOption[] = [];

  if (heli && cross) {
    const split = blend(heli, cross, Math.min(150, heli.qty), Math.min(180, cross.qty));
    pack.push(split, heli, cross);
    if (road) pack.push(road);
    primary = split;
  } else {
    pack.push(...ranked.slice(0, 4));
  }

  const why: Factor[] = [
    {
      factor: "Snow probability",
      effect: args.snowProb > 0.45 ? "hurts" : "helps",
      weight: args.snowProb,
      detail: `Ridge snow ${Math.round(args.snowProb * 100)}% — road mean delay climbs.`,
    },
    {
      factor: "Route confidence",
      effect: args.routeConfidence < 0.5 ? "hurts" : "helps",
      weight: 1 - args.routeConfidence,
      detail: `Primary track confidence ${Math.round(args.routeConfidence * 100)}%.`,
    },
    {
      factor: "Days of stock",
      effect: args.daysOfStock < 5 ? "hurts" : "helps",
      weight: Math.max(0, (5 - args.daysOfStock) / 5),
      detail: `On-hand covers ${args.daysOfStock.toFixed(1)} days at P50 demand.`,
    },
    {
      factor: "P90 delivery time",
      effect: args.p90DaysRoad > args.daysOfStock ? "hurts" : "helps",
      weight: clamp01(args.p90DaysRoad / Math.max(1, args.daysOfStock + 0.2) - 0.6),
      detail: `P90 road delivery ${args.p90DaysRoad.toFixed(1)} days vs ${args.daysOfStock.toFixed(1)} days of stock.`,
    },
  ];

  const title =
    primary?.kind === "split_shipment"
      ? "Combined lift — helicopter plus cross-level"
      : primary
        ? primary.label
        : "Hold and monitor";

  const summary =
    primary?.kind === "split_shipment"
      ? `Move ${Math.min(150, heli?.qty ?? 150)} via helicopter now and cross-level ${Math.min(180, cross?.qty ?? 180)} from BRAVO-7. Road is a fallback after the snow window. Authorise the cross-level if it is not yet released.`
      : (primary?.label ?? "No feasible option in the current picture.");

  return {
    id: "rec-focus",
    title,
    summary,
    primary: primary?.kind ?? "road",
    options: pack,
    expectedDeliveryConfidence: primary?.deliveryConfidence ?? 0.2,
    expectedStockoutRisk: primary?.stockoutIfChosen ?? 0.8,
    why: why.sort((a, b) => b.weight - a.weight),
  };
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}
