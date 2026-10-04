import { daysLabel, pctPts } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useOpsStore } from "@/store/ops-store";

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "ok" | "warn" | "danger" | "default";
}) {
  const color =
    tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-fg";
  return (
    <div className="min-w-[9.5rem] flex-1 rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
      <p className="font-display text-[0.7rem] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl tabular-nums", color)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function KpiStrip() {
  const kpis = useOpsStore((s) => s.report.kpis);
  const focus = useOpsStore((s) => s.report.focus);
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      <Kpi
        label="Stockout risk"
        value={pctPts(kpis.stockoutRisk * 100)}
        hint={`${focus.unit.callsign} · ${daysLabel(focus.inventory.daysOfStockP50)} of stock`}
        tone={kpis.stockoutRisk >= 0.55 ? "danger" : kpis.stockoutRisk >= 0.28 ? "warn" : "ok"}
      />
      <Kpi
        label="Delivery confidence"
        value={pctPts(kpis.deliveryConfidence * 100)}
        hint="Primary road option"
        tone={kpis.deliveryConfidence >= 0.7 ? "ok" : kpis.deliveryConfidence >= 0.45 ? "warn" : "danger"}
      />
      <Kpi
        label="Critical items"
        value={String(kpis.criticalItems)}
        hint="Posts above 45% stockout"
        tone={kpis.criticalItems >= 3 ? "danger" : kpis.criticalItems >= 1 ? "warn" : "ok"}
      />
      <Kpi
        label="Active shipments"
        value={String(kpis.activeShipments)}
        hint="En route / held / planned"
        tone="default"
      />
    </div>
  );
}
