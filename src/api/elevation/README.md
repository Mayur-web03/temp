# elevation

`openElevation.ts` samples heights along a route.

Order: in-memory/local cache → Open-Meteo elevation (no key) → Open-Elevation (optional key) → weather/archive DEM already attached to each post.

Results are cached seven days. Do not call this on every dashboard paint.
