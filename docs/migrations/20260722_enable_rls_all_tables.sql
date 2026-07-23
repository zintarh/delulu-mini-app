-- Lock down direct Data API (PostgREST) access to every table in the
-- public schema. All 22 tables were exposed with Row Level Security
-- disabled, meaning anyone holding the project's anon key could read or
-- write any row directly against the REST API, bypassing the app server
-- entirely (session checks, wallet-ownership checks, etc. all live in the
-- Next.js API routes, not in the database).
--
-- Enabling RLS with no policies attached defaults to deny-all for the
-- `anon` and `authenticated` Postgres roles. This is safe to run: the app
-- itself never queries Supabase using those roles — every server route
-- uses the service-role key (via getSupabaseAdmin()), which always
-- bypasses RLS regardless of policies. Nothing in the app's current
-- behavior depends on anon/authenticated access, so this only removes
-- access that shouldn't have existed.
--
-- Run this in the Supabase SQL editor.

do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
