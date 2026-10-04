import { Link } from "@tanstack/react-router";
import { pctPts } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useOpsStore } from "@/store/ops-store";

export function ActionCard() {
  const rec = useOpsStore((s) => s.report.focus.recommendation);
  const runRecommendedPlan = useOpsStore((s) => s.runRecommendedPlan);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI recommendation</CardTitle>
      </CardHeader>
      <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight">{rec.title}</h3>
      <p className="mt-2 text-sm text-muted">{rec.summary}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="font-display text-[0.65rem] uppercase tracking-[0.14em] text-muted">Expected confidence</dt>
          <dd className="font-mono text-lg tabular-nums text-ok">{pctPts(rec.expectedDeliveryConfidence * 100)}</dd>
        </div>
        <div>
          <dt className="font-display text-[0.65rem] uppercase tracking-[0.14em] text-muted">Residual stockout</dt>
          <dd className="font-mono text-lg tabular-nums text-warn">{pctPts(rec.expectedStockoutRisk * 100)}</dd>
        </div>
      </dl>
      <ul className="mt-4 space-y-2">
        {rec.options.slice(0, 4).map((opt) => (
          <li key={opt.id} className="flex items-center justify-between gap-2 text-sm">
            <span className={opt.feasible ? "text-fg" : "text-muted"}>
              {opt.label}
              {opt.feasible ? "" : " · pending"}
            </span>
            <span className="font-mono tabular-nums text-muted">{pctPts(opt.deliveryConfidence * 100)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2">
        <p className="font-display text-[0.65rem] uppercase tracking-[0.14em] text-muted">Why</p>
        {rec.why.slice(0, 4).map((w) => (
          <p key={w.factor} className="text-sm text-muted">
            <span className={w.effect === "hurts" ? "text-danger" : "text-ok"}>{w.factor}</span>
            {" — "}
            {w.detail}
          </p>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" onClick={runRecommendedPlan}>
          Commit recommended plan
        </Button>
        <Button variant="outline" className="flex-1" asChild>
          <Link to="/simulator">Open simulator</Link>
        </Button>
      </div>
    </Card>
  );
}
