import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { daysLabel } from "@/lib/format";
import { useOpsStore } from "@/store/ops-store";

export function LegendPanel() {
  const focus = useOpsStore((s) => s.report.focus);
  const weather = useOpsStore((s) => s.world.weather);
  const loc = useOpsStore((s) => s.world.locations.find((l) => l.id === focus.unit.locationId));
  const wx = weather.find((w) => w.locationId === loc?.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{focus.unit.callsign}</CardTitle>
      </CardHeader>
      <p className="text-sm text-muted">
        {loc?.name} · {loc?.elevationM} m · troops {focus.unit.troopStrength} · mission {focus.unit.mission}
      </p>
      <p className="mt-3 text-sm">
        {focus.item.name}: {Math.round(focus.inventory.onHand)} {focus.item.unit} on hand ·{" "}
        {daysLabel(focus.inventory.daysOfStockP50)} of stock
      </p>
      {wx ? (
        <p className="mt-3 text-sm text-muted">
          {wx.summary} Snow {Math.round(wx.snowProb * 100)}% · vis {wx.visibilityKm} km · {wx.tempC}°C
        </p>
      ) : null}
    </Card>
  );
}
