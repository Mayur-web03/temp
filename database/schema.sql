-- SenaSetu AI — paste this entire file into the Supabase SQL editor.
-- Training picture only. Safe for the anon / publishable key (no personal data).
-- After it runs: put VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env, or paste
-- the same keys in the Live feeds panel. Empty projects are auto-seeded.

create table if not exists locations (
  id text primary key,
  name text not null,
  code text not null,
  kind text not null check (kind in ('depot', 'fob', 'post')),
  lat double precision not null,
  lng double precision not null,
  elevation_m integer not null,
  helipad boolean not null default false
);

create table if not exists units (
  id text primary key,
  callsign text not null,
  location_id text not null references locations(id),
  echelon text not null check (echelon in ('depot', 'fob', 'post')),
  troop_strength integer not null,
  mission text not null check (mission in ('low', 'medium', 'high')),
  commander text not null
);

create table if not exists items (
  id text primary key,
  name text not null,
  short text not null,
  category text not null,
  unit text not null,
  cold_chain boolean not null default false,
  base_per_person_per_day double precision not null,
  criticality double precision not null
);

create table if not exists stock_levels (
  unit_id text not null references units(id),
  item_id text not null references items(id),
  on_hand double precision not null,
  safety_days double precision not null default 5,
  updated_at timestamptz not null default now(),
  primary key (unit_id, item_id)
);

create table if not exists consumption_events (
  id bigserial primary key,
  unit_id text not null references units(id),
  item_id text not null references items(id),
  day date not null,
  qty double precision not null
);

create unique index if not exists consumption_events_unit_item_day
  on consumption_events (unit_id, item_id, day);

create table if not exists routes (
  id text primary key,
  name text not null,
  from_location_id text not null references locations(id),
  to_location_id text not null references locations(id),
  mode text not null,
  distance_km double precision not null,
  slope_deg double precision not null,
  road_condition text not null,
  bridge_load_t double precision,
  path jsonb not null default '[]',
  base_speed_kmh double precision not null,
  capacity double precision not null,
  duration_min double precision,
  elevation_gain_m double precision,
  highway text,
  surface text,
  road_name text,
  source text
);

create table if not exists route_status (
  route_id text primary key references routes(id),
  snow_prob double precision not null,
  landslide_prob double precision not null,
  visibility_km double precision not null,
  closed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists shipments (
  id text primary key,
  origin_unit_id text not null references units(id),
  dest_unit_id text not null references units(id),
  item_id text not null references items(id),
  qty double precision not null,
  mode text not null,
  route_id text not null references routes(id),
  status text not null,
  departed_at timestamptz,
  eta_at timestamptz not null,
  confidence double precision not null
);

create table if not exists forecasts (
  unit_id text not null references units(id),
  item_id text not null references items(id),
  p10 double precision not null,
  p50 double precision not null,
  p90 double precision not null,
  generated_at timestamptz not null default now(),
  primary key (unit_id, item_id)
);

create table if not exists recommendations (
  id text primary key,
  unit_id text not null references units(id),
  item_id text not null references items(id),
  title text not null,
  summary text not null,
  primary_action text not null,
  expected_delivery_confidence double precision not null,
  expected_stockout_risk double precision not null,
  payload jsonb not null default '{}',
  generated_at timestamptz not null default now()
);

create table if not exists feed_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create table if not exists elevation_cache (
  lat numeric(9,4) not null,
  lng numeric(9,4) not null,
  elevation_m double precision not null,
  fetched_at timestamptz not null default now(),
  primary key (lat, lng)
);

alter table locations add column if not exists helipad boolean not null default false;
alter table routes add column if not exists duration_min double precision;
alter table routes add column if not exists elevation_gain_m double precision;
alter table routes add column if not exists highway text;
alter table routes add column if not exists surface text;
alter table routes add column if not exists road_name text;
alter table routes add column if not exists source text;
alter table stock_levels add column if not exists updated_at timestamptz not null default now();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'locations',
    'units',
    'items',
    'stock_levels',
    'consumption_events',
    'routes',
    'route_status',
    'shipments',
    'forecasts',
    'recommendations',
    'feed_cache',
    'elevation_cache'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists anon_all on %I', t);
    execute format(
      'create policy anon_all on %I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
