import { createServerFn } from "@tanstack/react-start";
import { daysLabel, pctPts } from "@/lib/format";
import type { DcreReport, ScenarioFlags } from "@/types/domain";

export function draftStaffNote(report: DcreReport, scenario: ScenarioFlags) {
  const f = report.focus;
  const rec = f.recommendation;
  const road = f.options.find((o) => o.kind === "road");
  const heli = f.options.find((o) => o.kind === "helicopter");
  const cross = f.options.find((o) => o.kind === "cross_level");
  const flags = [
    scenario.snowClosure ? "SNOW CLOSURE IN EFFECT" : null,
    scenario.routeDamaged ? "TRACK DAMAGE REPORTED" : null,
    scenario.helicopterAvailable ? "AIRFRAME AVAILABLE" : "NO AIRFRAME TASKED",
    scenario.crossLevelStock ? "CROSS-LEVEL AUTHORISED" : "CROSS-LEVEL NOT AUTHORISED",
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    "UNCLASSIFIED // TRAINING PICTURE ONLY",
    `FROM: SENASETU DCRE / SECTOR KAILASH`,
    `TO: G3 / G4 — ${f.unit.callsign}`,
    `DTG: ${new Date().toISOString().replace(/\.\d+Z$/, "Z")}`,
    `SUBJ: RESUPPLY DECISION BRIEF — ${f.unit.callsign} / ${f.item.short}`,
    "",
    "1. SITUATION",
    `   ${flags}.`,
    `   On-hand ${Math.round(f.inventory.onHand)} ${f.item.unit} · ${daysLabel(f.inventory.daysOfStockP50)} of stock at P50 demand.`,
    `   Demand P10/P50/P90: ${f.forecast.p10.toFixed(0)} / ${f.forecast.p50.toFixed(0)} / ${f.forecast.p90.toFixed(0)} ${f.item.unit}/day.`,
    `   Stockout risk ${pctPts(report.kpis.stockoutRisk * 100)} · readiness ${report.kpis.readiness.toUpperCase()}.`,
    "",
    "2. DELIVERY CONFIDENCE",
    `   Road:        ${pctPts((road?.deliveryConfidence ?? 0) * 100)}  (P90 ${daysLabel(road?.p90Days ?? 0)})`,
    `   Helicopter:  ${pctPts((heli?.deliveryConfidence ?? 0) * 100)}  (${heli?.feasible ? "feasible" : heli?.blockedReason ?? "blocked"})`,
    `   Cross-level: ${pctPts((cross?.deliveryConfidence ?? 0) * 100)}  (${cross?.feasible ? "feasible" : cross?.blockedReason ?? "blocked"})`,
    "",
    "3. RECOMMENDATION",
    `   ${rec.title}.`,
    `   ${rec.summary}`,
    `   Expected delivery confidence ${pctPts(rec.expectedDeliveryConfidence * 100)}; residual stockout ${pctPts(rec.expectedStockoutRisk * 100)}.`,
    "",
    "4. WHY",
    ...rec.why.map((w, i) => `   ${i + 1}) ${w.factor} — ${w.detail}`),
    "",
    "5. REQUESTED ACTION",
    "   Approve recommended plan, task air + cross-level, and re-run Monte Carlo on commit.",
    "",
    "SENASETU AI — delivery-confidence resupply engine",
    "Synthetic dataset. Not an operational system of record.",
  ].join("\n");
}

export const polishStaffNote = createServerFn({ method: "POST" })
  .validator((input: { draft: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, text: data.draft, error: "AI polish unavailable" };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "You are a G3/G4 staff officer. Rewrite the brief in crisp military staff-note English. Keep UNCLASSIFIED header, numbers, and recommendation. No flourish, no markdown fences, no emoji.",
          },
          { role: "user", content: data.draft },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, text: data.draft, error: `xAI API error ${res.status}` };
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    return { ok: true as const, text: body.choices[0]?.message.content ?? data.draft };
  });
