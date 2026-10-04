# SenaSetu AI — architecture

SenaSetu is a **decision-support** system, not an inventory dashboard.

```
                    REAL PUBLIC DATA
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
   Open-Meteo          OSRM          Elevation
   + MET Norway        Routes        + archive DEM
        │                │                │
        └────────────────┼────────────────┘
                         ↓
                   DATA ADAPTER
                         ↓
                   WorldSnapshot
                         ↑
                         │
                    Supabase / local
              Inventory / Shipments / Units
                         │
                         ↓
                    DCRE ENGINE
                         ↓
                Forecast / Risk / Action
```

IoT stays in `src/iot/simulator.ts`.

## Runtime

One TanStack Start app (React + TypeScript). The DCRE engine, Monte Carlo, and recommenders run in-process. Docker is intentionally omitted.

## Data

- Default: deterministic synthetic seed in `src/data` + localStorage.
- Live weather/routes/elevation from public APIs through `src/api`. Failures fall back per-field, never crash the picture.
- Optional: Supabase via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (or keys pasted in the UI). Empty keys → local. Empty projects auto-seed after `database/schema.sql`.
- Scenario toggles overlay the live picture (snow closure, heli, cross-level).

## Core modules

| Module | Path | Job |
| --- | --- | --- |
| Quantile demand | `src/ml/forecasting` | P10/P50/P90 from troops, altitude, weather, mission |
| Route risk | `src/ml/routeRisk` | Confidence 0–100 from slope, snow, condition, mode |
| Delivery confidence | `src/ml/deliveryConfidence` | P(arrives before stockout) |
| Inventory | `src/engine/inventory` | Days of stock vs demand |
| Optimizer | `src/optimization` | Rank road / heli / cross-level / split |
| Twin | `src/simulation` | Scenario injects + Monte Carlo |
| Orchestrator | `src/engine/dcre.ts` | Builds the command picture |
| Adapter | `src/api` | Public APIs → WorldSnapshot |

DCRE does not know whether a number came from Open-Meteo, OSRM, Supabase, or the seed.

No blockchain, no Kubernetes, no classified feeds, no chatbot-as-product.
