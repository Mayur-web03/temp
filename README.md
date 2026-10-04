# SenaSetu AI

**Delivery-Confidence Resupply Engine (DCRE)** for a synthetic Northern Frontier sector.

> Will the supply reach the forward post before it runs out — and if not, what is the best alternative?

This is a decision-support system, not an inventory dashboard. Demand, inventory, terrain, weather, and transport collapse into one number: **delivery confidence**. From that, the engine recommends a resupply action and lets you simulate it.

## What you can do

- Command picture: stockout, delivery confidence, critical posts, live map
- Route risk map coloured by confidence (ground vs air)
- Quantile demand (P10 / P50 / P90) with explainable drivers
- Recommendation: road, helicopter, cross-level, split, pre-position
- Digital twin: snow, airframe, track damage, cross-level authority
- Staff note for G3/G4 (optional xAI polish)

Dataset is **synthetic / anonymised**. One sector, three echelons, five posts, twelve items, ~90 days of consumption.

## Data

By default everything runs **locally** from `src/data`.

To use Supabase, put these in `.env`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

If either is missing, the app keeps using the local seed. Schema: `database/schema.sql`.

## Stack

React + TypeScript + TanStack Start + Tailwind. DCRE, Monte Carlo, and the recommender are TypeScript so the demo is one deployable app. Docker is out of scope for this build.

## Modules

| Priority | Module |
| --- | --- |
| 1 | Delivery confidence |
| 2 | Route risk map |
| 3 | Stockout risk |
| 4 | Recommendation engine |
| 5 | Scenario simulator |
| 6 | Demand forecast |
| 7 | Explainability |

Intentionally not built: blockchain, Kubernetes, native mobile, full ERP, microservices, RL, classified data, satellite feeds, a chatbot as the product.

## Demo flow

See `docs/demo-script.md`. Short version: snow warning → road confidence collapses → ALPHA-12 stockout climbs → DCRE ranks helicopter vs cross-level vs road → commit combined plan → risk drops → staff note.
