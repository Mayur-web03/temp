import type { IotReading } from "@/types/domain";

export function tickIot(rows: IotReading[], now = Date.now()): IotReading[] {
  return rows.map((row, i) => {
    const phase = (now / 1000 + i * 17) % 40;
    if (row.kind === "temp") {
      const drift = Math.sin(phase / 6) * (row.ok ? 0.25 : 0.8);
      const value = Number((row.value + drift).toFixed(1));
      return {
        ...row,
        value,
        ok: row.label.includes("CHARLIE") ? value < 8 : value < 6,
        updatedAt: new Date(now).toISOString(),
      };
    }
    if (row.kind === "gps") {
      return {
        ...row,
        value: Number((row.value + 0.0008).toFixed(4)),
        updatedAt: new Date(now).toISOString(),
      };
    }
    return { ...row, updatedAt: new Date(now).toISOString() };
  });
}
