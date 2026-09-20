-- Reschedule history.
--
-- Moving a booking is routine here, not an exception: the court is affected by
-- weather, and when it rains the session gets moved rather than refunded. The
-- booking keeps its reference code and its entire payment history; only the slot
-- changes. This table remembers where it came from, so the logbook can show
-- "moved from 21 Sep" and nobody has to reconstruct it from memory.

create table public.booking_reschedules (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,

  from_date       date not null,
  from_start_time time not null,
  from_end_time   time not null,

  to_date       date not null,
  to_start_time time not null,
  to_end_time   time not null,

  -- Free text, but the UI offers "Rain", "Customer request" and "Court issue"
  -- as one-tap options, because those are nearly all of them.
  reason text,

  moved_by   uuid references public.staff (id),
  created_at timestamptz not null default now()
);

comment on table public.booking_reschedules is
  'Audit trail of slot moves. The booking row always holds the CURRENT slot.';

create index booking_reschedules_booking_idx
  on public.booking_reschedules (booking_id, created_at desc);
