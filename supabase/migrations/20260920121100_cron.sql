-- Expiring stale holds.
--
-- WHY THIS JOB HAS TO EXIST.
-- A pending request blocks its slot so two people are never negotiating the same
-- hour. That block is implemented by the bookings_no_overlap EXCLUDE constraint,
-- whose predicate is `blocks_availability` -- a stored generated column.
--
-- Index predicates must be IMMUTABLE, and now() is not. So the constraint
-- physically cannot say "...unless the hold has lapsed". The status has to be
-- MATERIALISED from 'pending' to 'expired' by something that runs on a clock.
--
-- Three layers, so a stalled job degrades rather than breaks:
--   1. This scheduled sweep (the real mechanism).
--   2. An opportunistic sweep inside create_booking() for the date being booked.
--   3. A defensive filter in get_availability() so a lapsed hold never even
--      renders as busy.

create or replace function public.expire_stale_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.bookings
     set status = 'expired'
   where status = 'pending'
     and hold_expires_at is not null
     and hold_expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_stale_holds is
  'Releases lapsed pending holds. Run every minute by pg_cron, or by Vercel Cron.';

-- Schedule it if pg_cron is available. Wrapped because the extension is not
-- guaranteed on every Supabase plan, and a migration must not fail over an
-- optional scheduler -- /api/cron/expire-holds is the documented fallback.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- Unschedule first so re-running the migration chain stays idempotent.
    begin
      perform cron.unschedule('paddlepass-expire-holds');
    exception when others then
      null;  -- not scheduled yet
    end;

    perform cron.schedule(
      'paddlepass-expire-holds',
      '* * * * *',
      $cron$ select public.expire_stale_holds(); $cron$
    );

    raise notice 'pg_cron scheduled: paddlepass-expire-holds runs every minute.';
  else
    raise warning
      'pg_cron unavailable. Hold expiry MUST be driven by Vercel Cron hitting /api/cron/expire-holds.';
  end if;
end;
$$;
