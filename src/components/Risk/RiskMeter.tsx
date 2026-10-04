import { cn } from "@/lib/utils";

export function RiskMeter({
  value,
  label,
  invert = false,
}: {
  value: number;
  label: string;
  invert?: boolean;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const tone = invert
    ? pct >= 70
      ? "text-ok"
      : pct >= 45
        ? "text-warn"
        : "text-danger"
    : pct >= 55
      ? "text-danger"
      : pct >= 28
        ? "text-warn"
        : "text-ok";
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 108 108" className="size-28">
        <circle cx="54" cy="54" r={r} fill="none" stroke="currentColor" className="text-surface-2" strokeWidth="8" />
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke="currentColor"
          className={tone}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dash}
          transform="rotate(-90 54 54)"
        />
        <text
          x="54"
          y="52"
          textAnchor="middle"
          className="fill-fg font-mono"
          style={{ fontSize: "22px" }}
        >
          {pct}
        </text>
        <text x="54" y="70" textAnchor="middle" className="fill-muted" style={{ fontSize: "9px" }}>
          %
        </text>
      </svg>
      <p className={cn("font-display text-xs uppercase tracking-[0.16em] text-muted", tone)}>{label}</p>
    </div>
  );
}
