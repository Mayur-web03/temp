# data adapter

External feeds collapse into `WorldSnapshot`. DCRE never talks to Open-Meteo, OSRM, or Overpass.

```
Open-Meteo / MET Norway / OSRM / Open-Elevation / Overpass
                    ↓
              src/api/* adapters  →  WeatherNow / Route / Location
                    ↓
               WorldSnapshot
                    ↓
                   DCRE
```

IoT stays in `src/iot/simulator.ts`. No live telemetry.

| Folder | Source | Key? |
| --- | --- | --- |
| `weather/` | Open-Meteo forecast, archive; MET Norway fallback | No |
| `routing/` | OSRM public router | No |
| `elevation/` | Open-Meteo elevation, then Open-Elevation | Optional |
| `geocode/` | Open-Meteo geocoding | No |
| `osm/` | Overpass, small bbox only | No |

Ops data (stock, shipments, consumption, units) lives in Supabase when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set, or when the same keys are pasted in the Live feeds panel. Otherwise localStorage. Empty projects are auto-seeded after `database/schema.sql` is applied.

High-pass posts that are not on the civilian OSM network keep training-picture tracks. OSRM is only accepted when both ends snap within 4 km and the distance is not a Himalayan detour.
