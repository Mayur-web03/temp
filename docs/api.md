# SenaSetu AI — engine API

There is no public REST surface. The UI calls pure TypeScript functions. External HTTP is confined to `src/api`.

## `runDcre(world, scenario, focus?) → DcreReport`

Returns KPIs, per-post risk, and a focus package:

- `forecast` — P10/P50/P90 + drivers
- `inventory` — days of stock, stockout risk
- `options` — scored resupply actions with delivery confidence
- `recommendation` — primary action + WHY factors
- `monteCarlo` — P(stockout), P(arrive first), remaining-stock histogram

## `assembleWorld()`

Pulls ops data (Supabase or local), then enriches with Open-Meteo / MET Norway weather, Open-Meteo archive, OSRM, elevation, and Overpass. Always returns a `WorldSnapshot` — live fields where they worked, seed where they did not.

## `runMonteCarlo({ onHand, p50, p90, meanDays, p90Days })`

Samples lognormal demand and transit. Stockout if demand × transit > on-hand, or if the lift aborts.

## Staff note

`draftStaffNote(report, scenario)` always works locally.

`polishStaffNote` is a server function that optionally rewrites the draft with xAI when `XAI_API_KEY` is present. Failures return the local draft.

## Supabase

If env or pasted keys are set, `loadOps()` reads `units`, `locations`, `items`, `stock_levels`, `routes`, `shipments`, `consumption_events`. Missing schema or empty project: seed locally (and auto-insert if the schema is present).
