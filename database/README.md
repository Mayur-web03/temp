# database

Paste `schema.sql` into the Supabase SQL editor once. It creates the ops tables, unique consumption index, feed/elevation caches, grants, and RLS policies so the anon key can read/write training-picture data.

Then put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`, or paste the same keys in the Live feeds panel.

Empty projects are auto-seeded. If keys are missing or the schema is not applied, the app stays on the local training picture — DCRE still runs.
