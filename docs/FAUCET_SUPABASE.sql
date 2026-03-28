-- Delulu faucet claim storage (Supabase/Postgres)
-- Run this in Supabase SQL editor.

create table if not exists public.faucet_claims (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  amount numeric not null,
  tx_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists faucet_claims_address_idx
  on public.faucet_claims (address);

create index if not exists faucet_claims_created_at_idx
  on public.faucet_claims (created_at desc);
