import { useState } from "react";
import { CloudSun, Database, Mountain, Radio, Route as RouteIcon, Satellite } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { FeedKindStatus } from "@/api/types";
import { readSupabaseKeys } from "@/api/keys";
import { useOpsStore } from "@/store/ops-store";

const ROWS: Array<{ key: keyof NonNullable<ReturnType<typeof feedsOf>>; label: string; icon: typeof CloudSun }> = [
  { key: "weather", label: "Weather", icon: CloudSun },
  { key: "routing", label: "Routes", icon: RouteIcon },
  { key: "elevation", label: "Elevation", icon: Mountain },
  { key: "osm", label: "OSM / terrain", icon: Satellite },
  { key: "ops", label: "Ops database", icon: Database },
  { key: "iot", label: "IoT", icon: Radio },
];

function feedsOf(world: { feeds?: import("@/api/types").DataFeeds }) {
  return world.feeds;
}

function tone(status: FeedKindStatus["status"]): "ok" | "warn" | "default" {
  if (status === "live") return "ok";
  if (status === "cached") return "warn";
  return "default";
}

export function FeedPanel() {
  const world = useOpsStore((s) => s.world);
  const hydrating = useOpsStore((s) => s.hydrating);
  const feedError = useOpsStore((s) => s.feedError);
  const refreshFeeds = useOpsStore((s) => s.refreshFeeds);
  const connectDatabase = useOpsStore((s) => s.connectDatabase);
  const disconnectDatabase = useOpsStore((s) => s.disconnectDatabase);
  const source = useOpsStore((s) => s.source);
  const feeds = world.feeds;
  const keys = typeof window === "undefined" ? null : readSupabaseKeys();
  const [url, setUrl] = useState(keys?.origin === "local" ? keys.url : "");
  const [anon, setAnon] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr(null);
    try {
      if (!url.trim() || !anon.trim()) throw new Error("Need both project URL and anon key.");
      await connectDatabase(url.trim(), anon.trim());
      setAnon("");
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : "Could not connect");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live feeds</CardTitle>
        <Button variant="outline" size="sm" onClick={() => void refreshFeeds()} disabled={hydrating}>
          {hydrating ? "Syncing" : "Refresh"}
        </Button>
      </CardHeader>
      {feedError ? <p className="mb-3 text-sm text-danger">{feedError}</p> : null}
      <ul className="space-y-2">
        {ROWS.map((row) => {
          const Icon = row.icon;
          const feed = feeds?.[row.key];
          return (
            <li key={row.key} className="flex items-start gap-3 rounded-lg bg-surface-2 px-3 py-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{row.label}</p>
                  <Badge tone={feed ? tone(feed.status) : "default"}>{feed?.status ?? "seed"}</Badge>
                </div>
                <p className="truncate text-xs text-muted">
                  {feed ? `${feed.provider}${feed.detail ? ` · ${feed.detail}` : ""}` : "Training picture"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs uppercase tracking-wider text-muted">Supabase</p>
        {keys?.origin === "env" ? (
          <p className="mt-2 text-sm text-muted">Keys loaded from environment. Ops {source === "supabase" ? "live" : "fell back to local"}.</p>
        ) : source === "supabase" || keys?.origin === "local" ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-muted">{keys?.url}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void disconnectDatabase()}
              disabled={hydrating}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <form className="mt-2 space-y-2" onSubmit={(e) => void save(e)}>
            <input
              className="h-11 w-full rounded-lg bg-surface-2 px-3 text-sm outline-none"
              placeholder="https://xxxx.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              aria-label="Supabase project URL"
            />
            <input
              className="h-11 w-full rounded-lg bg-surface-2 px-3 text-sm outline-none"
              placeholder="anon / publishable key"
              value={anon}
              onChange={(e) => setAnon(e.target.value)}
              autoComplete="off"
              type="password"
              aria-label="Supabase anon key"
            />
            {formErr ? <p className="text-sm text-danger">{formErr}</p> : null}
            <Button type="submit" size="sm" disabled={busy || hydrating}>
              {busy ? "Connecting" : "Use these keys"}
            </Button>
            <p className="text-xs text-muted">
              Paste schema.sql in the SQL editor first. Empty projects are auto-seeded. Leave blank to stay local.
            </p>
          </form>
        )}
      </div>
    </Card>
  );
}
