-- Snapshot stake/destination onto forfeit_commitments so the feed can show
-- "Failed. Forfeit 100 G$ to Charity" without waiting on subgraph indexing.
-- Run in Supabase SQL editor.

alter table public.forfeit_commitments
  add column if not exists stake_amount_wei text;

alter table public.forfeit_commitments
  add column if not exists token text;

alter table public.forfeit_commitments
  add column if not exists destination_type int;

alter table public.forfeit_commitments
  add column if not exists destination_addr text;

alter table public.forfeit_commitments
  add column if not exists destination_friend_username text;

alter table public.forfeit_commitments
  add column if not exists destination_friend_email text;
