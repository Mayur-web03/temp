import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useOpsStore } from "@/store/ops-store";

export function ForecastChart() {
  const world = useOpsStore((s) => s.world);
  const focus = useOpsStore((s) => s.report.focus);
  const series = world.consumption.find(
    (c) => c.unitId === focus.unit.id && c.itemId === focus.item.id,
  );
  const history = (series?.daily ?? []).slice(-30).map((v, i) => ({
    d: i + 1,
    used: v,
  }));
  const forward = Array.from({ length: 14 }, (_, i) => ({
    d: 30 + i + 1,
    p10: Number(focus.forecast.p10.toFixed(1)),
    p50: Number(focus.forecast.p50.toFixed(1)),
    p90: Number(focus.forecast.p90.toFixed(1)),
  }));
  const data = [
    ...history.map((h) => ({ ...h, p10: undefined, p50: undefined, p90: undefined })),
    { d: 30, used: history[history.length - 1]?.used, p10: focus.forecast.p10, p50: focus.forecast.p50, p90: focus.forecast.p90 },
    ...forward,
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Demand · {focus.unit.callsign}</CardTitle>
          <p className="mt-1 text-sm text-muted">
            {focus.item.name} · last 30 days and 14-day P10 / P50 / P90
          </p>
        </div>
      </CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(236,238,230,0.08)" vertical={false} />
            <XAxis dataKey="d" tick={{ fill: "#8d9186", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8d9186", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              contentStyle={{ background: "#151613", border: "1px solid rgba(236,238,230,0.12)", borderRadius: 8 }}
              labelStyle={{ color: "#8d9186" }}
            />
            <Area type="monotone" dataKey="p90" stroke="none" fill="#c45c4a" fillOpacity={0.12} />
            <Area type="monotone" dataKey="p10" stroke="none" fill="#0c0d0b" fillOpacity={1} />
            <Area type="monotone" dataKey="p50" stroke="#d5d8ce" fill="none" strokeWidth={2} />
            <Area type="monotone" dataKey="used" stroke="#7d9a78" fill="#7d9a78" fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 font-mono text-sm tabular-nums">
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wider text-muted">P10</dt>
          <dd>{focus.forecast.p10.toFixed(0)}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wider text-muted">P50</dt>
          <dd>{focus.forecast.p50.toFixed(0)}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wider text-muted">P90</dt>
          <dd>{focus.forecast.p90.toFixed(0)}</dd>
        </div>
      </dl>
    </Card>
  );
}
