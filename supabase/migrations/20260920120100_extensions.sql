-- Extensions PaddlePass depends on.
--
-- btree_gist is the important one: it teaches GiST how to index scalar equality
-- (our court_id) so a single EXCLUDE constraint can combine "same court" with
-- "overlapping time range". Without it the no-double-booking guarantee in
-- 20260920120500_bookings.sql cannot be expressed at all.

create extension if not exists btree_gist;

-- gen_random_uuid() and the CSPRNG used by the reference-code generator.
create extension if not exists pgcrypto;

-- Trigram search, so the logbook can find "delacruz" when the row says "dela Cruz".
create extension if not exists pg_trgm;
