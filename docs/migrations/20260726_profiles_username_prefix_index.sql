-- Speeds up forfeit friend-verifier username search (ilike prefix / contains).
-- Requires pg_trgm (usually available on Supabase). Safe to re-run.

create extension if not exists pg_trgm;

create index if not exists profiles_username_trgm_idx
  on public.profiles using gin (username gin_trgm_ops)
  where username is not null;
