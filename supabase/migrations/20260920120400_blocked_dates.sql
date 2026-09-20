-- Dates the court is shut: holidays, maintenance, private events.
--
-- Whole days only. Partial-day closures were deliberately left out of v1: they
-- would need their own overlap handling against bookings, and the gym's actual
-- cases (Christmas, resurfacing) are all full days. A half-day closure can be
-- approximated today by booking the hours to the gym's own name.

create table public.blocked_dates (
  id           uuid primary key default gen_random_uuid(),
  blocked_date date not null unique,

  -- Shown to customers on the public calendar. Keep it bland and safe to publish.
  public_reason text not null default 'Closed',

  -- Internal note, never leaves the admin side. Split from public_reason so staff
  -- can write "Leo's wedding, gym closed" without it appearing on a public page.
  internal_note text,

  created_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);

comment on table public.blocked_dates is
  'Whole-day closures. public_reason is published; internal_note never is.';

create index blocked_dates_date_idx on public.blocked_dates (blocked_date);
