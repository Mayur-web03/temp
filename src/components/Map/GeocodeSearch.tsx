import { useState } from "react";
import { searchPlace } from "@/api/live";
import type { GeoHit } from "@/api/types";
import { Button } from "@/components/ui/button";
import { useOpsStore } from "@/store/ops-store";

export function GeocodeSearch() {
  const [q, setQ] = useState("Leh");
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const setPreviewHit = useOpsStore((s) => s.setPreviewHit);
  const previewHit = useOpsStore((s) => s.previewHit);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const found = await searchPlace({ data: { q } });
      setHits(found);
      if (found[0]) setPreviewHit(found[0]);
      if (!found.length) setErr("No match. Try Leh, Diskit, or Nubra.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Geocoding failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => void run(e)}>
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg bg-surface-2 px-3">
          <span className="text-xs uppercase tracking-wider text-muted">Place</span>
          <input
            className="h-11 w-full bg-transparent text-sm outline-none"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Leh, Diskit, Nubra…"
            aria-label="Geocode a place"
          />
        </label>
        <Button type="submit" disabled={busy} className="sm:w-36">
          {busy ? "Looking up" : "Geocode"}
        </Button>
      </form>
      {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
      {previewHit ? (
        <p className="mt-2 font-mono text-xs text-muted">
          {previewHit.name}
          {previewHit.admin1 ? `, ${previewHit.admin1}` : ""} · {previewHit.latitude.toFixed(4)}N{" "}
          {previewHit.longitude.toFixed(4)}E
          {previewHit.elevation != null ? ` · ${Math.round(previewHit.elevation)} m` : ""}
        </p>
      ) : null}
      {hits.length > 1 ? (
        <ul className="mt-2 divide-y divide-border">
          {hits.map((hit) => (
            <li key={`${hit.name}-${hit.latitude}`}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm"
                onClick={() => setPreviewHit(hit)}
              >
                <span>
                  {hit.name}
                  {hit.admin1 ? ` · ${hit.admin1}` : ""}
                </span>
                <span className="font-mono text-xs text-muted">
                  {hit.latitude.toFixed(2)}, {hit.longitude.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
