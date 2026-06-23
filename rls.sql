-- StatDrop — Row Level Security
-- Run this in the Supabase SQL editor.
-- Safe to re-run on an existing database.

-- 1. Ensure coach_id column exists (safe no-op if already present)
alter table teams add column if not exists coach_id uuid references auth.users(id);

-- 2. Enable RLS on all tables (idempotent)
alter table teams      enable row level security;
alter table players    enable row level security;
alter table game_stats enable row level security;

-- 3. Add position column to players (safe no-op if already present)
alter table players add column if not exists position text;

-- 4. Drop any existing policies to avoid conflicts on re-run
drop policy if exists "public read teams"        on teams;
drop policy if exists "coaches insert own teams" on teams;
drop policy if exists "coaches update own teams" on teams;
drop policy if exists "coaches delete own teams" on teams;
drop policy if exists "public read players"      on players;
drop policy if exists "auth insert players"      on players;
drop policy if exists "public insert players"    on players;
drop policy if exists "public read stats"        on game_stats;
drop policy if exists "auth insert stats"        on game_stats;
drop policy if exists "auth update stats"        on game_stats;

-- 5. teams ─────────────────────────────────────────────────────────────────
create policy "public read teams"
  on teams for select
  using (true);

create policy "coaches insert own teams"
  on teams for insert
  to authenticated
  with check (auth.uid() = coach_id);

create policy "coaches update own teams"
  on teams for update
  to authenticated
  using  (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "coaches delete own teams"
  on teams for delete
  to authenticated
  using (auth.uid() = coach_id);

-- 7. players ───────────────────────────────────────────────────────────────
create policy "public read players"
  on players for select
  using (true);

-- Covers both coaches (authenticated) and players joining via code (anon).
create policy "public insert players"
  on players for insert
  with check (true);

-- 8. game_stats ────────────────────────────────────────────────────────────
create policy "public read stats"
  on game_stats for select
  using (true);

create policy "auth insert stats"
  on game_stats for insert
  to authenticated
  with check (true);

create policy "auth update stats"
  on game_stats for update
  to authenticated
  using (true)
  with check (true);
