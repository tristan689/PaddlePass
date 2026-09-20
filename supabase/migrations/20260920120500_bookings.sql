-- Bookings. The heart of the system.
--
-- TIME MODEL
-- Slots are stored as Manila wall-clock `date` + `time`, not timestamptz. Two
-- reasons, and the second is the binding one:
--   1. The Philippines has had no DST since 1844, so wall-clock is unambiguous.
--   2. `AT TIME ZONE` is STABLE, not IMMUTABLE, so it cannot appear in a generated
--      column or an index predicate. Storing timestamptz would make the exclusion
--      constraint below impossible to express.
-- `timestamptz` is used only for true instants (created_at, hold_expires_at).
--
-- MONEY
-- rate_cents and paddle_fee_cents are SNAPSHOTTED here at request time. When the
-- owner raises the rate next month, historical bookings and every logbook row must
-- keep saying what the customer actually owed. Reading the live settings at report
-- time would silently rewrite the past.

create type public.booking_status as enum (
  'pending',      -- public submitted; holds the slot until hold_expires_at
  'approved',     -- admin confirmed; no money recorded yet
  'downpayment',  -- partially paid
  'paid',         -- settled
  'completed',    -- played and settled
  'cancelled',    -- called off after approval
  'declined',     -- admin rejected the request
  'expired',      -- hold ran out before anyone confirmed
  'no_show'       -- never turned up
);

-- What the calendar renders. Null once a booking releases its slot.
create type public.booking_calendar_state as enum (
  'pending', 'approved', 'downpayment', 'paid'
);

create table public.bookings (
  id             uuid primary key default gen_random_uuid(),

  -- Short, human-dictatable identifier. NOT a credential -- see lookup_token.
  reference_code text not null unique,
  -- Secret that makes /r/<ref> safe: knowing a short code is not enough to read
  -- someone else's booking details.
  lookup_token   text not null unique,

  -- One court today. Two bytes now is far cheaper than retrofitting the exclusion
  -- constraint when a second court appears.
  court_id       smallint not null default 1,

  -- The CURRENT slot. Changes when a booking is rescheduled (rain happens);
  -- the previous values are kept in booking_reschedules.
  booking_date   date not null,
  start_time     time not null,
  end_time       time not null,

  status         public.booking_status not null default 'pending',

  customer_name  text not null,
  contact        text not null,
  facebook_name  text not null,
  customer_note  text,

  -- Flat fee per paddle for the whole booking, NOT per hour.
  paddle_count   smallint not null default 0 check (paddle_count >= 0),

  rate_cents        integer not null check (rate_cents        >= 0),
  paddle_fee_cents  integer not null check (paddle_fee_cents  >= 0),
  total_cents       integer not null check (total_cents       >= 0),
  -- Maintained by a trigger on public.payments; never written directly.
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),

  -- Null once the booking is no longer merely pending.
  hold_expires_at timestamptz,

  approved_by uuid references public.staff (id),
  approved_at timestamptz,

  -- Set when staff mark the customer as having turned up.
  checked_in_at timestamptz,

  -- Why a booking was declined or cancelled; shown in the admin history.
  resolution_note text,

  created_by uuid references public.staff (id),  -- null for public submissions
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bookings_hours_ordered check (end_time > start_time),
  constraint bookings_name_present  check (length(trim(customer_name)) > 0),

  -- ---------------------------------------------------------------------
  -- Generated columns. Stored, so they can be indexed and can never drift
  -- from the values they derive from.
  -- ---------------------------------------------------------------------

  -- `date + time` and the tsrange constructor are both IMMUTABLE, which is what
  -- lets this be a stored generated column and therefore indexable.
  slot_range tsrange generated always as (
    tsrange(booking_date + start_time, booking_date + end_time, '[)')
  ) stored,

  -- Does this row occupy its slot? Drives the exclusion constraint's predicate.
  -- A plain boolean column reference is trivially immutable, which is safer in an
  -- index predicate than re-deriving the status list there.
  blocks_availability boolean generated always as (
    status = any (array[
      'pending'::public.booking_status,
      'approved'::public.booking_status,
      'downpayment'::public.booking_status,
      'paid'::public.booking_status,
      'completed'::public.booking_status,
      'no_show'::public.booking_status
    ])
  ) stored,

  -- Collapses nine lifecycle states into the four the calendar paints, so a whole
  -- month renders from one index scan with no joins and no aggregates.
  calendar_state public.booking_calendar_state generated always as (
    case status
      when 'pending'     then 'pending'::public.booking_calendar_state
      when 'approved'    then 'approved'::public.booking_calendar_state
      when 'downpayment' then 'downpayment'::public.booking_calendar_state
      when 'paid'        then 'paid'::public.booking_calendar_state
      when 'completed'   then 'paid'::public.booking_calendar_state
      -- Occupied the slot but never settled; reads as "not paid" to staff.
      when 'no_show'     then 'approved'::public.booking_calendar_state
      else null
    end
  ) stored,

  -- =====================================================================
  -- THE GUARANTEE.
  --
  -- Two people must never hold the same hour. This is enforced by the storage
  -- engine, not by application code: two concurrent inserts for overlapping
  -- hours produce one winner and one SQLSTATE 23P01 (exclusion_violation),
  -- with no locks to take and no retry loop to get wrong.
  --
  -- It holds even if someone bypasses the app and inserts by hand, which is
  -- why it beats an advisory lock or a SERIALIZABLE transaction.
  --
  -- The `where` predicate is what lets cancelled, declined and expired rows
  -- stop reserving their slot while staying in the table for the audit trail.
  -- =====================================================================
  constraint bookings_no_overlap exclude using gist (
    court_id   with =,
    slot_range with &&
  ) where (blocks_availability)
);

comment on table public.bookings is
  'Court bookings. bookings_no_overlap makes double-booking structurally impossible.';
comment on column public.bookings.rate_cents is
  'Snapshot at request time. A later rate change must not rewrite historical rows.';
comment on column public.bookings.reference_code is
  'Public identifier, not a secret. Use lookup_token to authorise reads.';
comment on column public.bookings.hold_expires_at is
  'When a pending request stops reserving its slot. Swept by the expire-holds job.';

-- Month calendar: one index scan over a date range of occupied rows.
create index bookings_calendar_idx
  on public.bookings (booking_date, start_time)
  where blocks_availability;

create index bookings_status_idx on public.bookings (status);

-- The approval queue, newest first.
create index bookings_pending_idx
  on public.bookings (created_at desc)
  where status = 'pending';

-- The hold-expiry sweep touches only pending rows with a deadline.
create index bookings_hold_idx
  on public.bookings (hold_expires_at)
  where status = 'pending' and hold_expires_at is not null;

-- Logbook keyset pagination.
create index bookings_logbook_idx on public.bookings (booking_date desc, id desc);

-- Fuzzy name search: finds "dela Cruz" when someone types "delacruz".
create index bookings_name_trgm_idx
  on public.bookings using gin (customer_name gin_trgm_ops);

create or replace function public.touch_bookings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_bookings_updated_at();

-- ---------------------------------------------------------------------------
-- Reference code generation.
--
-- 30-character alphabet with every confusable pair removed (no 0/O, 1/I/L, U/V),
-- because these get read aloud over Messenger and retyped from screenshots.
--
-- Uniqueness is owned by the unique index, not by this function. We retry on
-- collision and widen the body after several failures rather than pretending a
-- random generator can promise uniqueness.
--
-- Randomness comes from gen_random_uuid(), which is core Postgres 13+ and backed
-- by a CSPRNG. Deliberately NOT pgcrypto's gen_random_bytes(): Supabase installs
-- pgcrypto into the `extensions` schema, so an unqualified call depends on the
-- caller's search_path and a qualified one breaks if the project installed it
-- elsewhere. Core functions sidestep the question entirely.
-- ---------------------------------------------------------------------------

create or replace function public.random_bytes_core(p_count integer)
returns bytea
language sql
volatile
as $$
  -- Each UUID contributes 16 bytes (122 bits of entropy after the version and
  -- variant bits). Concatenate enough of them, then trim to the requested length.
  select substring(
    string_agg(uuid_send(gen_random_uuid()), ''::bytea)
    from 1 for p_count
  )
  from generate_series(1, (p_count + 15) / 16);
$$;

create or replace function public.generate_reference_code(p_length integer default 5)
returns text
language plpgsql
as $$
declare
  alphabet constant text    := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  n        constant integer := length(alphabet);       -- 30
  -- Largest multiple of n that fits in a byte (30 * 8 = 240). Bytes at or above
  -- this are discarded rather than folded, which keeps the distribution uniform.
  ceiling  constant integer := (256 / n) * n;
  out_text text := '';
  buf      bytea;
  b        integer;
  i        integer;
begin
  while length(out_text) < p_length loop
    -- Over-draw so rejections rarely cost a second round.
    buf := public.random_bytes_core((p_length - length(out_text)) * 2);

    for i in 0 .. octet_length(buf) - 1 loop
      b := get_byte(buf, i);
      continue when b >= ceiling;

      out_text := out_text || substr(alphabet, 1 + (b % n), 1);
      exit when length(out_text) = p_length;
    end loop;
  end loop;

  return 'UD-' || out_text;
end;
$$;

-- Fill in the identifiers on insert if the caller did not supply them.
create or replace function public.assign_booking_identifiers()
returns trigger
language plpgsql
as $$
declare
  attempt integer := 0;
  candidate text;
begin
  if new.lookup_token is null then
    -- 32 bytes of CSPRNG output. Unlike the reference code, this one IS a secret.
    new.lookup_token := encode(public.random_bytes_core(32), 'hex');
  end if;

  if new.reference_code is null then
    loop
      attempt := attempt + 1;
      -- Widen the code rather than spinning forever once the space gets crowded.
      candidate := public.generate_reference_code(case when attempt > 6 then 6 else 5 end);

      exit when not exists (
        select 1 from public.bookings b where b.reference_code = candidate
      );

      if attempt > 20 then
        raise exception 'Could not allocate a unique booking reference';
      end if;
    end loop;

    new.reference_code := candidate;
  end if;

  return new;
end;
$$;

create trigger bookings_assign_identifiers
  before insert on public.bookings
  for each row execute function public.assign_booking_identifiers();
