-- Fixes the slow "add a friend" search (forfeit verifier / forfeit-to-a-friend
-- pickers): email lookup was doing `ilike '%query%'` with zero matching index,
-- so every keystroke forced a sequential scan of the whole profiles table.
-- Mirrors the existing profiles_username_trgm_idx pattern
-- (docs/migrations/20260726_profiles_username_prefix_index.sql) but for email.
--
-- Also commits search_forfeit_friends() to source control — it previously
-- only existed as a hand-created function in the Supabase SQL editor, so its
-- ranking/limit behavior couldn't be reviewed or reproduced across
-- environments. Safe to re-run.

create extension if not exists pg_trgm;

create index if not exists profiles_email_trgm_idx
  on public.profiles using gin (email gin_trgm_ops)
  where email is not null;

-- Typeahead ranking: exact match, then prefix match, then trigram closeness —
-- the same ordering big-app username search (Twitter/Instagram-style) uses so
-- the most likely intended result lands first instead of alphabetically.
-- limit_count is a parameter (not hardcoded) so the API route's MAX_RESULTS
-- stays the single source of truth for how many rows come back.
create or replace function public.search_forfeit_friends(
  q text,
  exclude_addr text default null,
  limit_count int default 6
)
returns table (
  address text,
  username text,
  email text,
  pfp_url text
)
language sql
stable
as $$
  select address, username, email, pfp_url
  from public.profiles
  where username is not null
    and username ilike '%' || q || '%'
    and (exclude_addr is null or lower(address) <> lower(exclude_addr))
  order by
    (lower(username) = lower(q)) desc,
    (lower(username) like lower(q) || '%') desc,
    similarity(username, q) desc,
    username asc
  limit limit_count;
$$;
