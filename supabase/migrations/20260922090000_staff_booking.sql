-- Staff-entered bookings.
--
-- The public side is view-only: a customer taps a day on the calendar and lands in
-- Messenger. Staff then record the booking from the conversation. That booking is
-- confirmed the moment it is entered, so it is born `approved`, with no hold, and
-- attributed to the staffer who typed it in.
--
-- SECURITY INVOKER (the default) on purpose, like the other admin functions: it
-- runs as the signed-in staff member, RLS applies, and created_by / approved_by
-- are trustworthy rather than merely recorded.
--
-- Deliberately NOT re-validated: min/max hours, closed weekdays and blocked dates.
-- Staff enter what was actually agreed on Messenger, which is sometimes unusual.
-- The rules that still bind absolutely are the opening window and "do not
-- double-book" -- the EXCLUDE constraint arbitrates exactly as it does for any
-- other insert.

create or replace function public.create_staff_booking(
  p_date          date,
  p_start_hour    smallint,
  p_end_hour      smallint,
  p_paddle_count  smallint,
  p_customer_name text,
  p_contact       text,
  p_facebook_name text,
  p_note          text default null
)
returns public.bookings
language plpgsql
as $$
declare
  v_staff  uuid := public.current_staff_id();
  s        public.settings%rowtype;
  v_hours  integer;
  v_start  time;
  v_end    time;
  v_row    public.bookings%rowtype;
begin
  if v_staff is null then
    raise exception 'NOT_STAFF';
  end if;

  -- Serialise with public requests and reschedules touching this date.
  perform pg_advisory_xact_lock(hashtext('paddlepass:1:' || p_date::text));

  -- A lapsed hold must not block a booking staff are entering right now.
  update public.bookings b
     set status = 'expired'
   where b.booking_date = p_date
     and b.status = 'pending'
     and b.hold_expires_at is not null
     and b.hold_expires_at <= now();

  select * into s from public.settings where id = 1;

  if nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'MISSING_DETAILS';
  end if;

  v_hours := p_end_hour - p_start_hour;
  if v_hours <= 0 then
    raise exception 'INVALID_RANGE';
  end if;
  if p_start_hour < s.open_hour or p_end_hour > s.close_hour then
    raise exception 'OUTSIDE_HOURS';
  end if;
  if p_paddle_count < 0 or p_paddle_count > s.paddles_owned then
    raise exception 'PADDLES_UNAVAILABLE';
  end if;

  v_start := make_time(p_start_hour, 0, 0);
  v_end   := case when p_end_hour = 24 then time '24:00'
                  else make_time(p_end_hour, 0, 0) end;

  begin
    insert into public.bookings (
      booking_date, start_time, end_time, status,
      customer_name, contact, facebook_name, customer_note,
      paddle_count,
      rate_cents, paddle_fee_cents, total_cents,
      approved_by, approved_at, created_by
    )
    values (
      p_date, v_start, v_end, 'approved',
      trim(p_customer_name),
      trim(coalesce(p_contact, '')),
      trim(coalesce(p_facebook_name, '')),
      nullif(trim(coalesce(p_note, '')), ''),
      p_paddle_count,
      s.rate_cents, s.paddle_fee_cents,
      (v_hours * s.rate_cents) + (p_paddle_count * s.paddle_fee_cents),
      v_staff, now(), v_staff
    )
    returning * into v_row;
  exception
    when exclusion_violation then
      raise exception 'SLOT_TAKEN';
  end;

  return v_row;
end;
$$;

grant execute on function public.create_staff_booking(
  date, smallint, smallint, smallint, text, text, text, text
) to authenticated;
