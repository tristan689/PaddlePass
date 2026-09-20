-- Court settings: a single row holding every operating rule.
--
-- Nothing here is hardcoded in the app. Hours, rates, paddle stock and the hold
-- window are all editable by the owner, because the alternative is a code change
-- and a deploy every time the gym adjusts its pricing.
--
-- Money is integer centavos. Never numeric, never float -- a payment ledger that
-- drifts by rounding is one nobody trusts, and the drift is unrecoverable.

create table public.settings (
  -- Singleton. The check constraint makes a second row impossible rather than
  -- merely unlikely, so no query ever has to wonder which row is authoritative.
  id smallint primary key default 1 check (id = 1),

  -- Operating window. close_hour is exclusive: 22 means 21:00-22:00 is the last
  -- bookable slot. 24 is permitted (midnight close) but never wraps past it,
  -- because a slot crossing midnight would break the single-day range model.
  open_hour  smallint not null default 6  check (open_hour  between 0 and 23),
  close_hour smallint not null default 22 check (close_hour between 1 and 24),

  min_hours smallint not null default 1 check (min_hours >= 1),
  max_hours smallint not null default 6 check (max_hours >= 1),

  -- 0 = Sunday .. 6 = Saturday, matching extract(dow) and JS getUTCDay().
  closed_weekdays smallint[] not null default '{}',

  -- Court pricing.
  rate_cents        integer not null default 0 check (rate_cents        >= 0),
  downpayment_cents integer not null default 0 check (downpayment_cents >= 0),

  -- Paddle rental: a FLAT FEE PER PADDLE PER BOOKING, not per hour.
  -- paddles_owned caps what a customer may request.
  paddle_fee_cents integer  not null default 0 check (paddle_fee_cents >= 0),
  paddles_owned    smallint not null default 0 check (paddles_owned    >= 0),

  -- How long a pending request holds its slot before auto-releasing.
  hold_minutes integer not null default 120 check (hold_minutes >= 5),

  -- Drives the "Message the admin" button. Stored rather than env-baked so the
  -- owner can change pages without a redeploy.
  facebook_page text not null default 'undefeated.fitnesscenter',
  court_name    text not null default 'Undefeated Pickleball',

  updated_at timestamptz not null default now(),
  updated_by uuid,

  constraint settings_window_ordered check (close_hour > open_hour),
  constraint settings_hours_ordered  check (max_hours >= min_hours),
  -- A max longer than the day itself would let the picker offer impossible ranges.
  constraint settings_max_fits_day   check (max_hours <= close_hour - open_hour)
);

comment on table public.settings is
  'Singleton row of court operating rules. Edited by owners via /admin/settings.';
comment on column public.settings.paddle_fee_cents is
  'Flat fee per paddle for the whole booking -- deliberately NOT per hour.';
comment on column public.settings.close_hour is
  'Exclusive. 22 means the 21:00-22:00 slot is the last bookable one.';

-- Seed the singleton with zero money on purpose: the owner enters real figures on
-- first login. A plausible-looking fake rate is worse than an obvious blank,
-- because it can silently go live.
insert into public.settings (id) values (1) on conflict (id) do nothing;

create or replace function public.touch_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_settings_updated_at();
