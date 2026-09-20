-- The public API.
--
-- These four functions are the ENTIRE surface an anonymous visitor can reach.
-- `anon` has no table privileges at all (see 20260920120800_rls.sql), so anything
-- not returned here is unreachable, and a future policy mistake cannot widen that.
--
-- Each is SECURITY DEFINER with `search_path = ''` and every name fully qualified.
-- A SECURITY DEFINER function with a mutable search_path is a privilege-escalation
-- vector: an attacker who can create objects could shadow an unqualified name.

-- ---------------------------------------------------------------------------
-- What the public booking page needs to render. Deliberately a hand-listed
-- projection rather than `select *`, so adding a sensitive column to settings
-- later cannot accidentally publish it.
-- ---------------------------------------------------------------------------

create or replace function public.get_public_settings()
returns table (
  open_hour         smallint,
  close_hour        smallint,
  min_hours         smallint,
  max_hours         smallint,
  closed_weekdays   smallint[],
  rate_cents        integer,
  downpayment_cents integer,
  paddle_fee_cents  integer,
  paddles_owned     smallint,
  hold_minutes      integer,
  facebook_page     text,
  court_name        text,
  is_configured     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.open_hour,
    s.close_hour,
    s.min_hours,
    s.max_hours,
    s.closed_weekdays,
    s.rate_cents,
    s.downpayment_cents,
    s.paddle_fee_cents,
    s.paddles_owned,
    s.hold_minutes,
    s.facebook_page,
    s.court_name,
    (s.rate_cents > 0) as is_configured
  from public.settings s
  where s.id = 1;
$$;

-- ---------------------------------------------------------------------------
-- Occupied hours in a date range.
--
-- Returns WHEN the court is busy and HOW FAR ALONG the payment is -- never who
-- booked it. No name, no contact, no Facebook handle, no reference code.
-- This projection is the privacy requirement.
-- ---------------------------------------------------------------------------

create or replace function public.get_availability(p_from date, p_to date)
returns table (
  slot_date  date,
  start_hour smallint,
  end_hour   smallint,
  state      text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.booking_date as slot_date,
    extract(hour from b.start_time)::smallint as start_hour,
    -- A midnight close is stored as time '24:00', whose hour part is 0. Map it
    -- back to 24 so the caller sees a range that still reads as end > start.
    (case
       when b.end_time = time '24:00' then 24
       else extract(hour from b.end_time)
     end)::smallint as end_hour,
    b.calendar_state::text as state
  from public.bookings b
  where b.booking_date between p_from and p_to
    and b.blocks_availability
    -- Defence in depth against a stalled expiry sweep: an elapsed hold must never
    -- keep a slot looking busy, even if the cron job has not run.
    and not (
      b.status = 'pending'
      and b.hold_expires_at is not null
      and b.hold_expires_at <= now()
    )
  order by b.booking_date, b.start_time;
$$;

-- ---------------------------------------------------------------------------
-- Closures in a date range. Only the publishable reason -- internal_note stays
-- on the admin side.
-- ---------------------------------------------------------------------------

create or replace function public.get_blocked_dates(p_from date, p_to date)
returns table (blocked_date date, public_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.blocked_date, d.public_reason
  from public.blocked_dates d
  where d.blocked_date between p_from and p_to
  order by d.blocked_date;
$$;

-- ---------------------------------------------------------------------------
-- Submit a booking request.
--
-- The concurrency control point. Three things protect the slot, in order:
--
--   1. An advisory transaction lock on (court, date). This makes the
--      read-validate-write sequence atomic, so two requests for the same day
--      cannot both pass validation before either inserts.
--   2. The bookings_no_overlap EXCLUDE constraint, which is the real guarantee
--      and holds even against a direct SQL insert that skips this function.
--   3. An opportunistic expiry sweep, so a lapsed hold never blocks a live request
--      just because the cron job has not fired yet.
--
-- Errors are raised with stable machine-readable messages; the Next.js action maps
-- them to sentences a customer can act on.
-- ---------------------------------------------------------------------------

create or replace function public.create_booking(
  p_date          date,
  p_start_hour    smallint,
  p_end_hour      smallint,
  p_paddle_count  smallint,
  p_customer_name text,
  p_contact       text,
  p_facebook_name text,
  p_note          text default null
)
returns table (
  reference_code    text,
  lookup_token      text,
  total_cents       integer,
  downpayment_cents integer,
  hold_expires_at   timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s              public.settings%rowtype;
  v_today        date;
  v_now_hour     integer;
  v_hours        integer;
  v_total        integer;
  v_slot_start   timestamptz;
  v_hold         timestamptz;
  v_name         text := trim(p_customer_name);
  v_contact      text := trim(p_contact);
  v_facebook     text := trim(p_facebook_name);
  v_start_time   time;
  v_end_time     time;
  v_new          public.bookings%rowtype;
begin
  -- 1. Serialise everything touching this court on this date.
  perform pg_advisory_xact_lock(
    hashtext('paddlepass:1:' || p_date::text)
  );

  -- 2. Release any hold that has quietly lapsed.
  update public.bookings b
     set status = 'expired'
   where b.booking_date = p_date
     and b.status = 'pending'
     and b.hold_expires_at is not null
     and b.hold_expires_at <= now();

  select * into s from public.settings where id = 1;

  if s.rate_cents <= 0 then
    raise exception 'NOT_CONFIGURED';
  end if;

  -- Manila wall clock. Never the server clock: at 00:30 Manila the UTC date is
  -- still yesterday, which would reject today's perfectly valid bookings.
  v_today    := (now() at time zone 'Asia/Manila')::date;
  v_now_hour := extract(hour from (now() at time zone 'Asia/Manila'))::integer;

  -- ---- validation -------------------------------------------------------

  if v_name = '' or v_contact = '' or v_facebook = '' then
    raise exception 'MISSING_DETAILS';
  end if;

  if length(v_name) > 80 or length(v_contact) > 40 or length(v_facebook) > 80 then
    raise exception 'DETAILS_TOO_LONG';
  end if;

  if p_date < v_today then
    raise exception 'DATE_PAST';
  end if;

  if p_date = v_today and p_start_hour <= v_now_hour then
    raise exception 'TIME_PAST';
  end if;

  if p_start_hour < s.open_hour or p_end_hour > s.close_hour then
    raise exception 'OUTSIDE_HOURS';
  end if;

  v_hours := p_end_hour - p_start_hour;

  if v_hours <= 0 then
    raise exception 'INVALID_RANGE';
  end if;
  if v_hours < s.min_hours then
    raise exception 'BELOW_MIN_HOURS';
  end if;
  if v_hours > s.max_hours then
    raise exception 'ABOVE_MAX_HOURS';
  end if;

  -- extract(dow) and JS getUTCDay() agree: 0 = Sunday.
  if extract(dow from p_date)::smallint = any (s.closed_weekdays) then
    raise exception 'CLOSED_WEEKDAY';
  end if;

  if exists (select 1 from public.blocked_dates d where d.blocked_date = p_date) then
    raise exception 'DATE_BLOCKED';
  end if;

  if p_paddle_count < 0 then
    raise exception 'INVALID_PADDLES';
  end if;

  -- The court is exclusive, so at most one booking is ever active at a given
  -- instant. That means paddle demand never overlaps and a simple cap is
  -- sufficient -- no sum-over-overlapping-bookings capacity check is needed.
  if p_paddle_count > s.paddles_owned then
    raise exception 'PADDLES_UNAVAILABLE';
  end if;

  -- ---- price and hold ---------------------------------------------------

  -- Paddles are a flat fee per booking, NOT multiplied by hours.
  v_total := (v_hours * s.rate_cents) + (p_paddle_count * s.paddle_fee_cents);

  v_start_time := make_time(p_start_hour, 0, 0);
  v_end_time   := case
                    when p_end_hour = 24 then time '24:00'
                    else make_time(p_end_hour, 0, 0)
                  end;

  v_slot_start := (p_date + v_start_time) at time zone 'Asia/Manila';

  v_hold := now() + make_interval(mins => s.hold_minutes);
  -- Never hold past the slot itself, and never issue a hold so short that nobody
  -- could act on it.
  v_hold := least(v_hold, v_slot_start - interval '30 minutes');
  v_hold := greatest(v_hold, now() + interval '5 minutes');

  -- ---- insert -----------------------------------------------------------
  -- If another request won the race, bookings_no_overlap raises SQLSTATE 23P01
  -- and the exception handler below turns it into SLOT_TAKEN.

  begin
    insert into public.bookings (
      booking_date, start_time, end_time,
      customer_name, contact, facebook_name, customer_note,
      paddle_count,
      rate_cents, paddle_fee_cents, total_cents,
      hold_expires_at
    )
    values (
      p_date, v_start_time, v_end_time,
      v_name, v_contact, v_facebook, nullif(trim(coalesce(p_note, '')), ''),
      p_paddle_count,
      s.rate_cents, s.paddle_fee_cents, v_total,
      v_hold
    )
    returning * into v_new;
  exception
    when exclusion_violation then
      raise exception 'SLOT_TAKEN';
  end;

  return query
    select
      v_new.reference_code,
      v_new.lookup_token,
      v_new.total_cents,
      s.downpayment_cents,
      v_new.hold_expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Look up one booking for the /r/<reference> status page.
--
-- Requires BOTH the reference code and the lookup token. The reference alone is
-- short and guessable by design, so it is an identifier, not an authorisation.
-- Returns no personal details beyond the name the requester themselves supplied.
-- ---------------------------------------------------------------------------

create or replace function public.get_booking_by_token(
  p_reference text,
  p_token     text
)
returns table (
  reference_code  text,
  booking_date    date,
  start_hour      smallint,
  end_hour        smallint,
  paddle_count    smallint,
  customer_name   text,
  status          text,
  total_cents     integer,
  amount_paid_cents integer,
  hold_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.reference_code,
    b.booking_date,
    extract(hour from b.start_time)::smallint,
    (case when b.end_time = time '24:00' then 24
          else extract(hour from b.end_time) end)::smallint,
    b.paddle_count,
    b.customer_name,
    b.status::text,
    b.total_cents,
    b.amount_paid_cents,
    b.hold_expires_at
  from public.bookings b
  where b.reference_code = upper(trim(p_reference))
    and b.lookup_token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Each function is exposed deliberately, one line at a time.
-- ---------------------------------------------------------------------------

grant execute on function public.get_public_settings()               to anon, authenticated;
grant execute on function public.get_availability(date, date)        to anon, authenticated;
grant execute on function public.get_blocked_dates(date, date)       to anon, authenticated;
grant execute on function public.get_booking_by_token(text, text)    to anon, authenticated;
grant execute on function public.create_booking(
  date, smallint, smallint, smallint, text, text, text, text
) to anon, authenticated;
