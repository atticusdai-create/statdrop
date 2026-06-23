-- Run this in the Supabase SQL editor to set up the StatDrop schema

create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sport       text not null default 'Basketball',
  invite_code text not null unique,
  coach_id    uuid references auth.users(id),
  created_at  timestamptz default now()
);

create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  position   text,
  team_id    uuid references teams(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists game_stats (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid references players(id) on delete cascade,
  team_id         uuid references teams(id) on delete cascade,
  game_date       date not null,
  points          integer default 0,
  assists         integer default 0,
  rebounds        integer default 0,
  steals          integer default 0,
  blocks          integer default 0,
  created_at      timestamptz default now()
);

-- Enable Row Level Security
alter table teams      enable row level security;
alter table players    enable row level security;
alter table game_stats enable row level security;

-- ── teams ────────────────────────────────────────────────────────────────────
-- Anyone can read (public leaderboard).
create policy "public read teams"
  on teams for select
  using (true);

-- A coach can only insert a team they own.
create policy "coaches insert own teams"
  on teams for insert
  to authenticated
  with check (auth.uid() = coach_id);

-- A coach can only update their own teams and cannot reassign coach_id.
create policy "coaches update own teams"
  on teams for update
  to authenticated
  using  (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

-- ── players ──────────────────────────────────────────────────────────────────
create policy "public read players"
  on players for select
  using (true);

-- Anyone can add players — covers both coaches (authenticated) and players joining via code (anon).
create policy "public insert players"
  on players for insert
  with check (true);

-- ── game_stats ───────────────────────────────────────────────────────────────
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
