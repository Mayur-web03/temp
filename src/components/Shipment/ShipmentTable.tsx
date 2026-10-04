import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { pctPts } from "@/lib/format";
import { useOpsStore } from "@/store/ops-store";

const TONE = {
  planned: "default",
  enroute: "ok",
  held: "danger",
  delivered: "ok",
} as const;

export function ShipmentTable() {
  const world = useOpsStore((s) => s.world);
  const unitName = (id: string) => world.units.find((u) => u.id === id)?.callsign ?? id;
  const itemName = (id: string) => world.items.find((i) => i.id === id)?.short ?? id;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipments</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="font-display text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            <tr className="border-b border-border">
              <th className="py-2 pr-3 font-medium">Id</th>
              <th className="py-2 pr-3 font-medium">From</th>
              <th className="py-2 pr-3 font-medium">To</th>
              <th className="py-2 pr-3 font-medium">Item</th>
              <th className="py-2 pr-3 font-medium">Qty</th>
              <th className="py-2 pr-3 font-medium">Mode</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">Conf</th>
            </tr>
          </thead>
          <tbody>
            {world.shipments.map((s) => (
              <tr key={s.id} className="border-b border-border/60">
                <td className="py-3 pr-3 font-mono text-xs">{s.id.toUpperCase()}</td>
                <td className="py-3 pr-3">{unitName(s.originUnitId)}</td>
                <td className="py-3 pr-3">{unitName(s.destUnitId)}</td>
                <td className="py-3 pr-3">{itemName(s.itemId)}</td>
                <td className="py-3 pr-3 font-mono tabular-nums">{s.qty}</td>
                <td className="py-3 pr-3 capitalize">{s.mode.replace("_", " ")}</td>
                <td className="py-3 pr-3">
                  <Badge tone={TONE[s.status]}>{s.status}</Badge>
                </td>
                <td className="py-3 font-mono tabular-nums">{pctPts(s.confidence * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
