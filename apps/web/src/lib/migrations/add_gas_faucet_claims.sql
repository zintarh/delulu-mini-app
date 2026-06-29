-- Gas faucet claims tracking table.
-- Records are permanent and balance-independent: once status='sent',
-- that wallet/email can never receive faucet gas again regardless of on-chain balance.
create table if not exists public.gas_faucet_claims (
  id              uuid         primary key default gen_random_uuid(),
  address         text         not null,
  email           text,
  ip_address      text,
  tx_hash         text,
  amount_celo     numeric(10,4),
  agent_reasoning text,
  status          text         not null default 'pending'
                  check (status in ('pending', 'sent', 'failed', 'rejected')),
  created_at      timestamptz  not null default now()
);

-- One successful send per wallet address (DB-level hard backstop).
create unique index if not exists gas_faucet_claims_address_sent
  on public.gas_faucet_claims (address)
  where status = 'sent';

-- One successful send per email (SQL unique constraints skip nulls automatically).
create unique index if not exists gas_faucet_claims_email_sent
  on public.gas_faucet_claims (email)
  where status = 'sent' and email is not null;

-- Fast IP rate-limit queries.
create index if not exists gas_faucet_claims_ip_created
  on public.gas_faucet_claims (ip_address, created_at)
  where ip_address is not null;

-- Fast address lookups for pre-flight checks.
create index if not exists gas_faucet_claims_address_idx
  on public.gas_faucet_claims (address);
