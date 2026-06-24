-- Replace birth_year (integer) with date_of_birth (date) on the players table
alter table players add column if not exists date_of_birth date;
alter table players drop column if exists birth_year;
