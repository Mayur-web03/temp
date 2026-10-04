import { create } from "zustand";
import { assembleWorld } from "@/api/world";
import { hydrateLiveWorld } from "@/api/live";
import { dropLocalKeys, resetSupabase, writeLocalOps } from "@/api/persistence";
import { writeSupabaseKeys } from "@/api/keys";
import type { DataFeeds, GeoHit } from "@/api/types";
import { FOCUS } from "@/data/catalog";
import { buildSeedWorld, DEFAULT_SCENARIO } from "@/data/seed";
import { runDcre } from "@/engine/dcre";
import { tickIot } from "@/iot/simulator";
import { recommendedPlanFlags } from "@/simulation/scenarios";
import type { DcreReport, ScenarioFlags, WorldSnapshot } from "@/types/domain";

type OpsState = {
  world: WorldSnapshot;
  scenario: ScenarioFlags;
  selectedUnitId: string;
  selectedItemId: string;
  report: DcreReport;
  beforeReport: DcreReport | null;
  afterReport: DcreReport | null;
  source: "local" | "supabase";
  hydrated: boolean;
  hydrating: boolean;
  feedError: string | null;
  previewHit: GeoHit | null;
  setScenario: (patch: Partial<ScenarioFlags>) => void;
  toggleScenario: (key: keyof ScenarioFlags) => void;
  selectUnit: (unitId: string) => void;
  selectItem: (itemId: string) => void;
  selectPost: (unitId: string) => void;
  recompute: () => void;
  runRecommendedPlan: () => void;
  resetPicture: () => void;
  hydrateRemote: () => Promise<void>;
  refreshFeeds: () => Promise<void>;
  connectDatabase: (url: string, anonKey: string) => Promise<void>;
  disconnectDatabase: () => Promise<void>;
  tickSensors: () => void;
  setPreviewHit: (hit: GeoHit | null) => void;
};

function compute(world: WorldSnapshot, scenario: ScenarioFlags, unitId: string, itemId: string) {
  return runDcre(world, scenario, { unitId, itemId });
}

const seed = buildSeedWorld();
const initialReport = compute(seed, DEFAULT_SCENARIO, FOCUS.unitId, FOCUS.itemId);

function applyWorld(world: WorldSnapshot, get: () => OpsState) {
  const { scenario, selectedUnitId, selectedItemId } = get();
  writeLocalOps(world);
  return {
    world,
    source: world.source,
    hydrated: true,
    hydrating: false,
    feedError: null,
    report: compute(world, scenario, selectedUnitId, selectedItemId),
  };
}

function weatherFallback(world: WorldSnapshot) {
  return !world.feeds || world.feeds.weather.status === "fallback";
}

async function pullLiveWorld() {
  try {
    const clientWorld = await assembleWorld();
    if (!weatherFallback(clientWorld)) return clientWorld;
    try {
      const serverWorld = await hydrateLiveWorld();
      if (!weatherFallback(serverWorld)) return serverWorld;
      const serverLive = Object.values(serverWorld.feeds ?? {}).filter((f) => f.status === "live").length;
      const clientLive = Object.values(clientWorld.feeds ?? {}).filter((f) => f.status === "live").length;
      return serverLive >= clientLive ? serverWorld : clientWorld;
    } catch {
      return clientWorld;
    }
  } catch {
    return hydrateLiveWorld();
  }
}

export const useOpsStore = create<OpsState>()((set, get) => ({
  world: seed,
  scenario: { ...DEFAULT_SCENARIO },
  selectedUnitId: FOCUS.unitId,
  selectedItemId: FOCUS.itemId,
  report: initialReport,
  beforeReport: null,
  afterReport: null,
  source: "local",
  hydrated: false,
  hydrating: false,
  feedError: null,
  previewHit: null,
  setScenario: (patch) => {
    const scenario = { ...get().scenario, ...patch };
    const { world, selectedUnitId, selectedItemId } = get();
    set({
      scenario,
      beforeReport: null,
      afterReport: null,
      report: compute(world, scenario, selectedUnitId, selectedItemId),
    });
  },
  toggleScenario: (key) => {
    get().setScenario({ [key]: !get().scenario[key] });
  },
  selectUnit: (unitId) => {
    const { world, scenario, selectedItemId } = get();
    set({
      selectedUnitId: unitId,
      beforeReport: null,
      afterReport: null,
      report: compute(world, scenario, unitId, selectedItemId),
    });
  },
  selectItem: (itemId) => {
    const { world, scenario, selectedUnitId } = get();
    set({
      selectedItemId: itemId,
      beforeReport: null,
      afterReport: null,
      report: compute(world, scenario, selectedUnitId, itemId),
    });
  },
  selectPost: (unitId) => {
    const post = get().report.posts.find((p) => p.unit.id === unitId);
    const itemId = post?.item.id ?? get().selectedItemId;
    const { world, scenario } = get();
    set({
      selectedUnitId: unitId,
      selectedItemId: itemId,
      beforeReport: null,
      afterReport: null,
      report: compute(world, scenario, unitId, itemId),
    });
  },
  recompute: () => {
    const { world, scenario, selectedUnitId, selectedItemId } = get();
    set({ report: compute(world, scenario, selectedUnitId, selectedItemId) });
  },
  runRecommendedPlan: () => {
    const { world, scenario, selectedUnitId, selectedItemId } = get();
    const before = compute(world, scenario, selectedUnitId, selectedItemId);
    const applied = recommendedPlanFlags(scenario);
    const after = compute(world, applied, selectedUnitId, selectedItemId);
    set({
      scenario: applied,
      beforeReport: before,
      afterReport: after,
      report: after,
    });
  },
  resetPicture: () => {
    const world = get().world;
    set({
      scenario: { ...DEFAULT_SCENARIO },
      selectedUnitId: FOCUS.unitId,
      selectedItemId: FOCUS.itemId,
      beforeReport: null,
      afterReport: null,
      report: compute(world, DEFAULT_SCENARIO, FOCUS.unitId, FOCUS.itemId),
    });
  },
  hydrateRemote: async () => {
    if (get().hydrating) return;
    set({ hydrating: true, feedError: null });
    try {
      const world = await pullLiveWorld();
      set(applyWorld(world, get));
    } catch (err) {
      set({
        hydrating: false,
        hydrated: true,
        feedError: err instanceof Error ? err.message : "Live feeds unavailable",
      });
    }
  },
  refreshFeeds: async () => {
    set({ hydrating: true, feedError: null });
    try {
      const world = await pullLiveWorld();
      set({ ...applyWorld(world, get), beforeReport: null, afterReport: null });
    } catch (err) {
      set({
        hydrating: false,
        feedError: err instanceof Error ? err.message : "Refresh failed",
      });
    }
  },
  connectDatabase: async (url, anonKey) => {
    writeSupabaseKeys(url, anonKey);
    resetSupabase();
    await get().refreshFeeds();
  },
  disconnectDatabase: async () => {
    dropLocalKeys();
    await get().refreshFeeds();
  },
  tickSensors: () => {
    const world = get().world;
    set({ world: { ...world, iot: tickIot(world.iot) } });
  },
  setPreviewHit: (hit) => set({ previewHit: hit }),
}));

export function feedSummary(feeds: DataFeeds | undefined) {
  if (!feeds) return "Seed picture";
  const live = Object.values(feeds).filter((f) => f.status === "live").length;
  return `${live} live feeds`;
}
