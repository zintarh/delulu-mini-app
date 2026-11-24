-- Private Bingo photos (24 Nov 2026). A player can hide their Bingo photos
-- from everyone else: their progress (days kept, rank) still shows, the
-- photos show as locked tiles. The AI and admins still see every photo.
-- One switch per player, for all their cards. Default: public.
alter table public.profiles
  add column if not exists bingo_photos_private boolean not null default false;
