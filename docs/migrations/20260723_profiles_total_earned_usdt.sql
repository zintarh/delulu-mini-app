-- Lifetime app earnings in USDT (USD-equivalent).
-- Sum of G$, USDT, cUSD, and other non-CELO tokens received through Delulu
-- (UBI claims, delulu reward claims, etc.), converted at claim time.
alter table public.profiles
  add column if not exists total_earned_usdt numeric(24, 8) not null default 0;

comment on column public.profiles.total_earned_usdt is
  'Sum of app receipts converted to USDT/USD at claim time (excludes CELO gas)';
