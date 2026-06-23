-- Add rebounds column to game_stats table
ALTER TABLE game_stats
  ADD COLUMN IF NOT EXISTS rebounds integer NOT NULL DEFAULT 0;
