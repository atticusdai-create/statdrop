-- StatDrop — DELETE policies for the players table.
-- Run this in the Supabase SQL editor.
-- Safe to re-run (drops before creating).

drop policy if exists "coaches delete own team players" on players;
drop policy if exists "players delete own record"       on players;

-- Coaches may delete any player whose team_id belongs to a team they coach.
create policy "coaches delete own team players"
  on players for delete
  to authenticated
  using (
    exists (
      select 1 from teams
      where teams.id  = players.team_id
        and teams.coach_id = auth.uid()
    )
  );

-- Players may delete their own record (used by the delete-account flow).
create policy "players delete own record"
  on players for delete
  to authenticated
  using (user_id = auth.uid());
