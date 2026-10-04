import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskMeter } from "@/components/Risk/RiskMeter";
import { daysLabel, pctPts } from "@/lib/format";
import { draftStaffNote, polishStaffNote } from "@/lib/staff-note";
import { cn } from "@/lib/utils";
import { SCENARIO_META } from "@/simulation/scenarios";
import { useOpsStore } from "@/store/ops-store";

export function ScenarioBoard() {
  const scenario = useOpsStore((s) => s.scenario);
  const toggle = useOpsStore((s) => s.toggleScenario);
  const report = useOpsStore((s) => s.report);
  const beforeReport = useOpsStore((s) => s.beforeReport);
  const afterReport = useOpsStore((s) => s.afterReport);
  const runRecommendedPlan = useOpsStore((s) => s.runRecommendedPlan);
  const resetPicture = useOpsStore((s) => s.resetPicture);
  const [note, setNote] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);

  const hist = useMemo(
    () =>
      report.focus.monteCarlo.remainingStock.map((b) => ({
        n: b.n,
        label: Math.round(b.x0),
      })),
    [report.focus.monteCarlo.remainingStock],
  );

  async function onStaffNote() {
    const draft = draftStaffNote(report, scenario);
    setNote(draft);
    setPolishing(true);
    try {
      const polished = await polishStaffNote({ data: { draft } });
      setNote(polished.text);
    } catch {
      setNote(draft);
    } finally {
      setPolishing(false);
    }
  }

  const nowRisk = beforeReport?.kpis.stockoutRisk ?? report.kpis.stockoutRisk;
  const planRisk = afterReport?.kpis.stockoutRisk ?? report.focus.recommendation.expectedStockoutRisk;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Scenario injects</CardTitle>
          </CardHeader>
          <div className="grid gap-2">
            {SCENARIO_META.map((s) => {
              const on = scenario[s.key];
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggle(s.key)}
                  className={cn(
                    "min-h-14 rounded-lg px-4 py-3 text-left shadow-[var(--shadow-border)] transition-colors duration-[var(--motion-quick)]",
                    on ? "bg-primary text-primary-fg" : "bg-surface-2 text-fg hover:bg-surface",
                  )}
                >
                  <span className="block font-display text-sm uppercase tracking-[0.14em]">{s.label}</span>
                  <span className={cn("mt-1 block text-xs", on ? "text-primary-fg/80" : "text-muted")}>
                    {s.blurb}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button onClick={runRecommendedPlan} className="flex-1">
              Run recommended plan
            </Button>
            <Button variant="outline" onClick={resetPicture} className="flex-1">
              Reset picture
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Before / after</CardTitle>
          </CardHeader>
          <div className="flex justify-around">
            <RiskMeter value={nowRisk} label="Now · stockout" />
            <RiskMeter value={planRisk} label="If plan commits" />
            <RiskMeter
              value={report.focus.recommendation.expectedDeliveryConfidence}
              label="Plan confidence"
              invert
            />
          </div>
          <p className="mt-4 text-sm text-muted">
            {report.focus.unit.callsign} holds {daysLabel(report.focus.inventory.daysOfStockP50)} of{" "}
            {report.focus.item.short}. Monte Carlo ({report.focus.monteCarlo.samples} draws) puts P90
            delivery at {daysLabel(report.focus.monteCarlo.p90DeliveryDays)}.
          </p>
        </Card>
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Monte Carlo · remaining stock</CardTitle>
          </CardHeader>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hist}>
                <XAxis dataKey="label" tick={{ fill: "#8d9186", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "#151613", border: "1px solid rgba(236,238,230,0.12)" }}
                />
                <Bar dataKey="n" fill="#d5d8ce" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">P(stockout)</dt>
              <dd className="font-mono tabular-nums text-danger">
                {pctPts(report.focus.monteCarlo.pStockout * 100)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">P(arrives first)</dt>
              <dd className="font-mono tabular-nums text-ok">
                {pctPts(report.focus.monteCarlo.pArriveBeforeStockout * 100)}
              </dd>
            </div>
          </dl>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Staff note</CardTitle>
          </CardHeader>
          <p className="text-sm text-muted">
            Executable output for G3/G4. Generated from the live DCRE picture, not a chatbot.
          </p>
          <Button className="mt-3" variant="secondary" onClick={() => void onStaffNote()}>
            {polishing ? "Polishing…" : "Generate staff note"}
          </Button>
          {note ? (
            <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-3 font-mono text-xs leading-relaxed text-fg">
              {note}
            </pre>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
