import { createFileRoute } from "@tanstack/react-router";
import { ShipmentTable } from "@/components/Shipment/ShipmentTable";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useOpsStore } from "@/store/ops-store";

export const Route = createFileRoute("/_command/shipments")({
  component: ShipmentsPage,
});

function ShipmentsPage() {
  const options = useOpsStore((s) => s.report.focus.options);
  const rec = useOpsStore((s) => s.report.focus.recommendation);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Shipments</h1>
        <p className="mt-1 text-sm text-muted">
          Live legs plus the DCRE options that would put a new lift on the board.
        </p>
      </div>
      <ShipmentTable />
      <Card>
        <CardHeader>
          <CardTitle>Proposed lifts · {rec.title}</CardTitle>
        </CardHeader>
        <ul className="divide-y divide-border">
          {options.map((opt) => (
            <li key={opt.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-sm text-muted">
                  {opt.qty} units · {opt.meanDays.toFixed(1)}d mean · {opt.feasible ? "feasible" : opt.blockedReason}
                </p>
              </div>
              <p className="font-mono tabular-nums">{Math.round(opt.deliveryConfidence * 100)}%</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
