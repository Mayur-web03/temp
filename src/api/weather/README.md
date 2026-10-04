# weather

`openMeteo.ts` maps Open-Meteo current + hourly precip into `WeatherNow`. Snow probability is derived from snowfall, WMO code, and temperature — precipitation probability is not renamed to snow.

`metNo.ts` is the no-key fallback (MET Norway Locationforecast). Used when Open-Meteo is rate-limited.

`ceilingFt` is null unless a provider actually returns a ceiling. Route risk then uses visibility.

Historical series come from the Open-Meteo archive (separate host) and feed weather-shaped consumption.
