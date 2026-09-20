-- Admin operations and the logbook.
--
-- These are SECURITY INVOKER (the default) on purpose. They run as the signed-in
-- staff member, so RLS applies and auth.uid() resolves -- which is what makes
-- "who took this payment" trustworthy rather than merely recorded. Using the
-- service role here would collapse attribution to "the server did it".

-- ---------------------------------------------------------------------------
-- Approve a pending request.
-- ---------------------------------------------------------------------------

create or replace function public.approve_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
as $$
declare
  v_staff uuid := public.current_staff_id();
  v_row   public.bookings%rowtype;
begin
  if v_staff is null then
    raise exception 'NOT_STAFF';
  end if;

  select * into v_row from public.bookings where id = p_booking_id for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'NOT_PENDING';
  end if;

  update public.bookings
     set status          = 'approved',
         approved_by     = v_staff,
         approved_at     = now(),
         -- Approval is a commitment; the slot is no longer on a timer.
         hold_expires_at = null
   where id = p_booking_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Decline a request, or cancel an approved booking. One function: both are
-- "this booking releases its slot", and both must record a reason.
-- ---------------------------------------------------------------------------

create or replace function public.release_booking(
  p_booking_id uuid,
  p_status     text,          -- 'declined' | 'cancelled' | 'no_show'
  p_reason     text default null
)
returns public.bookings
language plpgsql
as $$
declare
  v_staff uuid := public.current_staff_id();
  v_row   public.bookings%rowtype;
begin
  if v_staff is null then
    raise exception 'NOT_STAFF';
  end if;
  if p_status not in ('declined', 'cancelled', 'no_show') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.bookings
     set status          = p_status::public.booking_status,
         resolution_note = nullif(trim(coalesce(p_reason, '')), ''),
         hold_expires_at = null
   where id = p_booking_id
  returning * into v_row;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Record a payment.
--
-- received_by is taken from the session, never from the caller's arguments, so
-- a staff member cannot attribute money to a colleague. The RLS policy on
-- payments enforces the same rule independently.
-- ---------------------------------------------------------------------------

create or replace function public.record_payment(
  p_booking_id   uuid,
  p_kind         text,        -- 'down_payment' | 'full_payment'
  p_method       text,        -- 'cash' | 'gcash'
  p_amount_cents integer,
  p_paid_on      date,
  p_external_ref text default null,
  p_note         text default null,
  p_approve      boolean default false   -- approve a pending booking in one pass
)
returns public.bookings
language plpgsql
as $$
declare
  v_staff uuid := public.current_staff_id();
  v_row   public.bookings%rowtype;
begin
  if v_staff is null then
    raise exception 'NOT_STAFF';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_kind not in ('down_payment', 'full_payment') then
    raise exception 'INVALID_KIND';
  end if;
  if p_method not in ('cash', 'gcash') then
    raise exception 'INVALID_METHOD';
  end if;

  select * into v_row from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  -- Staff almost always collect the downpayment over Messenger BEFORE approving,
  -- so approving and recording happen together rather than as two round-trips.
  if p_approve and v_row.status = 'pending' then
    update public.bookings
       set status = 'approved', approved_by = v_staff,
           approved_at = now(), hold_expires_at = null
     where id = p_booking_id;
  end if;

  insert into public.payments (
    booking_id, kind, method, amount_cents, paid_on, external_ref, note, received_by
  )
  values (
    p_booking_id,
    p_kind::public.payment_kind,
    p_method::public.payment_method,
    p_amount_cents,
    p_paid_on,
    nullif(trim(coalesce(p_external_ref, '')), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    v_staff
  );

  -- The payments trigger has already recomputed amount_paid_cents and status.
  select * into v_row from public.bookings where id = p_booking_id;
  return v_row;
end;
$$;

-- Void rather than delete: the ledger keeps the correction visible.
create or replace function public.void_payment(
  p_payment_id uuid,
  p_reason     text
)
returns public.bookings
language plpgsql
as $$
declare
  v_staff   uuid := public.current_staff_id();
  v_booking uuid;
  v_row     public.bookings%rowtype;
begin
  if v_staff is null then
    raise exception 'NOT_STAFF';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'REASON_REQUIRED';
  end if;

  update public.payments
     set voided_at = now(), voided_by = v_staff, void_reason = trim(p_reason)
   where id = p_payment_id
     and voided_at is null
  returning booking_id into v_booking;

  if v_booking is null then
    raise exception 'NOT_FOUND';
  end if;

  select * into v_row from public.bookings where id = v_booking;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Move a booking to a different slot.
--
-- The rain case, and routine here. The booking keeps its reference code and its
-- entire payment history; only the slot moves. The EXCLUDE constraint arbitrates
-- the new slot exactly as it does for a fresh booking, so a move can never
-- double-book.
-- ---------------------------------------------------------------------------

create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_date       date,
  p_start_hour smallint,
  p_end_hour   smallint,
  p_reason     text default null
)
returns public.bookings
language plpgsql
as $$
declare
  v_staff public.staff%rowtype;
  s       public.settings%rowtype;
  v_row   public.bookings%rowtype;
  v_hours integer;
  v_start time;
  v_end   time;
begin
  select * into v_staff from public.staff
   where id = (select auth.uid()) and active;
  if not found then
    raise exception 'NOT_STAFF';
  end if;

  perform pg_advisory_xact_lock(hashtext('paddlepass:1:' || p_date::text));

  select * into s from public.settings where id = 1;
  select * into v_row from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  v_hours := p_end_hour - p_start_hour;
  if v_hours <= 0 then
    raise exception 'INVALID_RANGE';
  end if;
  if p_start_hour < s.open_hour or p_end_hour > s.close_hour then
    raise exception 'OUTSIDE_HOURS';
  end if;

  -- Deliberately NOT re-validated: min/max hours, closed weekdays and blocked
  -- dates. Staff move bookings precisely because something unusual happened, and
  -- a rained-out Sunday session often has to land on a normally-closed day.
  -- The one rule that still binds absolutely is "do not double-book".

  v_start := make_time(p_start_hour, 0, 0);
  v_end   := case when p_end_hour = 24 then time '24:00'
                  else make_time(p_end_hour, 0, 0) end;

  insert into public.booking_reschedules (
    booking_id,
    from_date, from_start_time, from_end_time,
    to_date,   to_start_time,   to_end_time,
    reason, moved_by
  )
  values (
    p_booking_id,
    v_row.booking_date, v_row.start_time, v_row.end_time,
    p_date, v_start, v_end,
    nullif(trim(coalesce(p_reason, '')), ''), v_staff.id
  );

  begin
    update public.bookings
       set booking_date = p_date, start_time = v_start, end_time = v_end
     where id = p_booking_id
    returning * into v_row;
  exception
    when exclusion_violation then
      raise exception 'SLOT_TAKEN';
  end;

  return v_row;
end;
$$;

-- Mark the customer as having turned up.
create or replace function public.mark_arrived(p_booking_id uuid)
returns public.bookings
language plpgsql
as $$
declare
  v_row public.bookings%rowtype;
begin
  if public.current_staff_id() is null then
    raise exception 'NOT_STAFF';
  end if;

  update public.bookings
     set checked_in_at = coalesce(checked_in_at, now())
   where id = p_booking_id
  returning * into v_row;

  if not found then
    raise exception 'NOT_FOUND';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- The logbook.
--
-- Produces the seven requested columns as ONE row per booking:
--   Name | Hours | Date of Down Payment | MOP & Amount
--        | Date of Full Payment | MOP & Amount | Date of Arrival
--
-- The partial unique indexes on payments are what make this a plain LEFT JOIN
-- instead of an aggregate: there is at most one live downpayment and one live
-- full payment per booking, so each joins to a single row.
--
-- security_invoker = true is essential. A view defaults to running as its OWNER,
-- which would bypass the RLS policies on bookings and payments entirely.
-- ---------------------------------------------------------------------------

create or replace view public.admin_logbook
with (security_invoker = true)
as
select
  b.id,
  b.reference_code,
  b.customer_name,
  b.contact,
  b.facebook_name,
  b.status,
  b.calendar_state,

  -- "Hours" column: the duration, which is what the paper logbook recorded.
  (extract(epoch from (b.end_time - b.start_time)) / 3600)::numeric(4, 1) as hours,

  b.booking_date,
  b.start_time,
  b.end_time,
  b.paddle_count,

  b.rate_cents,
  b.paddle_fee_cents,
  b.total_cents,
  b.amount_paid_cents,
  greatest(b.total_cents - b.amount_paid_cents, 0) as balance_cents,

  -- Downpayment columns.
  dp.paid_on      as down_paid_on,
  dp.method       as down_method,
  dp.amount_cents as down_amount_cents,
  dps.full_name   as down_received_by,

  -- Full payment columns.
  fp.paid_on      as full_paid_on,
  fp.method       as full_method,
  fp.amount_cents as full_amount_cents,
  fps.full_name   as full_received_by,

  -- "Date of Arrival" is the date they actually play -- the CURRENT slot, after
  -- any reschedule. moved_from_date drives the "moved from 21 Sep" note.
  b.booking_date  as arrival_date,
  b.checked_in_at,
  rs.from_date    as moved_from_date,

  aps.full_name   as approved_by_name,
  b.approved_at,
  b.created_at
from public.bookings b
left join public.payments dp
       on dp.booking_id = b.id
      and dp.kind = 'down_payment'
      and dp.voided_at is null
left join public.payments fp
       on fp.booking_id = b.id
      and fp.kind = 'full_payment'
      and fp.voided_at is null
left join public.staff dps on dps.id = dp.received_by
left join public.staff fps on fps.id = fp.received_by
left join public.staff aps on aps.id = b.approved_by
-- Only the most recent move; the full history lives on the booking detail page.
left join lateral (
  select r.from_date
  from public.booking_reschedules r
  where r.booking_id = b.id
  order by r.created_at desc
  limit 1
) rs on true;

comment on view public.admin_logbook is
  'One row per booking with both payments flattened. security_invoker keeps RLS on.';

-- ---------------------------------------------------------------------------
-- Dashboard aggregates. One round trip instead of five.
-- ---------------------------------------------------------------------------

create or replace function public.dashboard_metrics(p_from date, p_to date)
returns json
language sql
stable
as $$
  with paid as (
    select p.amount_cents, b.paddle_count, b.paddle_fee_cents
    from public.payments p
    join public.bookings b on b.id = p.booking_id
    where p.voided_at is null
      and p.paid_on between p_from and p_to
  ),
  played as (
    select b.*
    from public.bookings b
    where b.booking_date between p_from and p_to
      and b.blocks_availability
  ),
  settings as (select * from public.settings where id = 1),
  capacity as (
    select
      -- Open hours across the period, minus closed weekdays and blocked dates.
      count(*) filter (
        where extract(dow from d)::smallint <> all (s.closed_weekdays)
          and not exists (
            -- generate_series yields timestamps; blocked_date is a date.
            select 1 from public.blocked_dates bd where bd.blocked_date = d::date
          )
      ) * (s.close_hour - s.open_hour) as open_hours
    from settings s
    cross join generate_series(p_from, p_to, interval '1 day') as d
    group by s.close_hour, s.open_hour
  )
  select json_build_object(
    'collected_cents',   (select coalesce(sum(amount_cents), 0) from paid),
    'paddle_cents',      (select coalesce(sum(paddle_count * paddle_fee_cents), 0)
                          from played),
    'outstanding_cents', (select coalesce(sum(greatest(total_cents - amount_paid_cents, 0)), 0)
                          from played),
    'booking_count',     (select count(*) from played),
    'booked_hours',      (select coalesce(sum(
                            extract(epoch from (end_time - start_time)) / 3600
                          ), 0) from played),
    'open_hours',        (select coalesce(open_hours, 0) from capacity),
    'no_shows',          (select count(*) from played where status = 'no_show'),
    'busiest_hours',     (select coalesce(json_agg(h order by h.hour), '[]'::json)
                          from (
                            select extract(hour from start_time)::int as hour,
                                   count(*) as bookings
                            from played
                            group by 1
                          ) h)
  );
$$;

-- ---------------------------------------------------------------------------
-- Grants. `authenticated` had every function revoked in the RLS migration, so
-- each admin entry point is re-exposed one line at a time.
-- ---------------------------------------------------------------------------

grant select on public.admin_logbook to authenticated;

grant execute on function public.approve_booking(uuid)                     to authenticated;
grant execute on function public.release_booking(uuid, text, text)         to authenticated;
grant execute on function public.record_payment(
  uuid, text, text, integer, date, text, text, boolean
) to authenticated;
grant execute on function public.void_payment(uuid, text)                  to authenticated;
grant execute on function public.reschedule_booking(
  uuid, date, smallint, smallint, text
) to authenticated;
grant execute on function public.mark_arrived(uuid)                        to authenticated;
grant execute on function public.dashboard_metrics(date, date)             to authenticated;

grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.is_staff()         to authenticated;
grant execute on function public.is_owner()         to authenticated;
