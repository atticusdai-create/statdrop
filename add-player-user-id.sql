-- Run this in the Supabase SQL editor to link player profiles to auth accounts.
-- Safe to re-run (uses IF NOT EXISTS).

-- 1. Add user_id so each player record can be linked to a Supabase auth user.
--    Nullable so coach-added players (who may not have accounts) still work.
alter table players add column if not exists user_id uuid references auth.users(id);

-- 2. Index for fast "find my player profile" lookups on login.
create index if not exists players_user_id_idx on players(user_id);
