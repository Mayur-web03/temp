export function pct(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function pctPts(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`;
}

export function daysLabel(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 20) return `${Math.round(n)}d`;
  return `${n.toFixed(1)}d`;
}

export function qty(n: number, unit?: string) {
  const abs = Math.abs(n);
  const formatted =
    abs >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString("en-IN");
  return unit ? `${formatted} ${unit}` : formatted;
}

export function callsign(id: string) {
  return id.replace(/_/g, "-");
}

export function toneForRisk(p: number): "ok" | "warn" | "danger" {
  if (p >= 0.55) return "danger";
  if (p >= 0.28) return "warn";
  return "ok";
}

export function toneForConfidence(p: number): "ok" | "warn" | "danger" {
  if (p >= 0.7) return "ok";
  if (p >= 0.45) return "warn";
  return "danger";
}
