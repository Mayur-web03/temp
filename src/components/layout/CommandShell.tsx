import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Activity, Box, Map, Radar, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Mark } from "@/components/layout/Mark";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useOpsStore } from "@/store/ops-store";

const NAV = [
  { to: "/", label: "Command", icon: Radar, exact: true },
  { to: "/map", label: "Map", icon: Map, exact: false },
  { to: "/forecast", label: "Forecast", icon: Activity, exact: false },
  { to: "/shipments", label: "Shipments", icon: Box, exact: false },
  { to: "/simulator", label: "Simulator", icon: SlidersHorizontal, exact: false },
] as const;

export function CommandShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hydrateRemote = useOpsStore((s) => s.hydrateRemote);
  const tickSensors = useOpsStore((s) => s.tickSensors);
  const source = useOpsStore((s) => s.source);
  const hydrating = useOpsStore((s) => s.hydrating);
  const feeds = useOpsStore((s) => s.world.feeds);
  const readiness = useOpsStore((s) => s.report.kpis.readiness);
  const [clock, setClock] = useState<string>("--------Z");

  useEffect(() => {
    void hydrateRemote();
  }, [hydrateRemote]);

  useEffect(() => {
    const tick = () => setClock(`${new Date().toISOString().slice(11, 19)}Z`);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => tickSensors(), 4000);
    return () => window.clearInterval(id);
  }, [tickSensors]);

  const weatherLive = feeds?.weather.status === "live" || feeds?.weather.status === "cached";
  const routeLive = feeds?.routing.status === "live" || feeds?.routing.status === "cached";

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur-sm md:px-6">
        <div className="flex items-center gap-3">
          <Mark className="size-8 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="font-display text-xl font-semibold tracking-[0.18em]">SENASETU</p>
              <span className="font-mono text-[0.65rem] text-muted">AI</span>
            </div>
            <p className="truncate font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted">
              Sector Kailash · Delivery-confidence resupply
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge tone={readiness === "critical" ? "danger" : readiness === "degraded" ? "warn" : "ok"}>
              {readiness}
            </Badge>
            <Badge tone={source === "supabase" ? "ok" : "default"}>{source === "supabase" ? "Supabase" : "Local ops"}</Badge>
            <Badge tone={weatherLive ? "live" : "default"}>{hydrating ? "Syncing" : weatherLive ? "Weather live" : "Weather seed"}</Badge>
            <Badge tone={routeLive ? "live" : "default"}>{routeLive ? "OSRM" : "Routes seed"}</Badge>
            <span className="font-mono text-xs tabular-nums text-muted">{clock}</span>
          </div>
        </div>
        <nav className="mt-3 hidden gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = item.exact ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm transition-colors duration-[var(--motion-quick)]",
                  active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface hover:text-fg",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-8">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 px-2 py-2 backdrop-blur-sm md:hidden"
        aria-label="Mobile"
      >
        <ul className="grid grid-cols-5 gap-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex h-12 flex-col items-center justify-center gap-0.5 rounded-md text-[0.65rem] uppercase tracking-wide",
                    active ? "bg-surface-2 text-fg" : "text-muted",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
