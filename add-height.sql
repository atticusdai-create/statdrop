-- Add height as a player attribute (not a game stat)
-- Height is stored as text so players can enter it as 6'2" or 6-2
alter table players add column if not exists height text;
