-- Optional. The app already seeds itself in TypeScript.
-- Use this only after applying schema.sql in a Supabase project.

insert into locations (id, name, code, kind, lat, lng, elevation_m, helipad) values
  ('loc-depot', 'Kailash Depot', 'DEPOT', 'depot', 34.164, 77.584, 3505, true),
  ('loc-fob', 'FOB Nubra', 'FOB-N', 'fob', 34.558, 77.549, 3180, true),
  ('loc-a12', 'Post ALPHA-12', 'A-12', 'post', 35.118, 77.472, 5380, true),
  ('loc-b7', 'Post BRAVO-7', 'B-7', 'post', 35.021, 77.638, 4905, false)
on conflict do nothing;

insert into items (id, name, short, category, unit, cold_chain, base_per_person_per_day, criticality) values
  ('i-ecc', 'Extreme Cold Clothing', 'ECC', 'clothing', 'sets', false, 0.191, 0.98)
on conflict do nothing;
