# routing

`osrm.ts` calls the public OSRM driving router (`longitude,latitude` order). Returns distance, duration, GeoJSON path, and snap distances.

Rejected when:
- either end snaps more than 4 km off the requested point
- road distance is more than ~2× the catalog length

Those legs stay as military-track overlays. Helicopters never go through OSRM.
