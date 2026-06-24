-- Add birth_year as a player attribute for age display
alter table players add column if not exists birth_year integer;
