-- Daily Boost (lib/bingo/boost.ts): G$ a player added to their Bingo card's
-- stake on a given day, before that day's photo. One row per on-chain
-- CommitmentBoosted event (ForfeitMarket.boostCommitment), recorded by
-- POST /api/bingo/attempts/[id]/boost after reading the receipt.
create table if not exists public.bingo_boosts (
  id            uuid primary key default gen_random_uuid(),
  attempt_id    uuid not null references public.bingo_attempts(id) on delete cascade,
  wallet        text not null,
  commitment_id bigint not null,          -- on-chain ForfeitMarket commitment id
  slot_index    int not null,              -- the card's day (0-based) = the period boosted
  amount        numeric not null check (amount > 0),
  tx_hash       text not null,
  log_index     int not null,
  created_at    timestamptz not null default now(),
  unique (tx_hash, log_index)
);
create index if not exists bingo_boosts_attempt_idx on public.bingo_boosts (attempt_id, slot_index);
create index if not exists bingo_boosts_day_idx on public.bingo_boosts (created_at desc);
alter table public.bingo_boosts enable row level security;
