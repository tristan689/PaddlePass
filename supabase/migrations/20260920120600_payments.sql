-- The payment ledger.
--
-- One row per payment received, rather than down/full columns flattened onto
-- bookings. Flattening is tempting -- the logbook wants exactly two payments per
-- row -- but it cannot express who received the money, corrections, or refunds,
-- and all three are required here. The two partial unique indexes below give us
-- the flattened query ergonomics anyway: the logbook stays a single-row LEFT JOIN.
--
-- Payments are VOIDED, never deleted. A ledger you can silently delete from is not
-- a ledger. Voided rows stay visible in the booking's history and drop out of the
-- totals.

create type public.payment_kind as enum ('down_payment', 'full_payment');

-- The gym takes exactly these two. Adding Maya or GoTyme later is one
-- `alter type ... add value` in its own migration.
create type public.payment_method as enum ('cash', 'gcash');

create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,

  kind   public.payment_kind   not null,
  method public.payment_method not null,

  amount_cents integer not null check (amount_cents > 0),

  -- The date the money actually changed hands, which is not always today --
  -- staff sometimes record a GCash transfer the morning after. This is the
  -- "Date of Down Payment" / "Date of Full Payment" column in the logbook.
  paid_on date not null,

  -- GCash reference number, when there is one.
  external_ref text,
  note         text,

  -- Always auth.uid() server-side, never chosen in the form. Staff cannot
  -- attribute a payment to a colleague -- that is the point of the accountability
  -- requirement, and a dropdown here would defeat it.
  received_by uuid not null references public.staff (id),

  voided_at   timestamptz,
  voided_by   uuid references public.staff (id),
  void_reason text,

  created_at timestamptz not null default now(),

  -- A void must record who did it, so the two fields travel together.
  constraint payments_void_attributed check (
    (voided_at is null and voided_by is null) or
    (voided_at is not null and voided_by is not null)
  )
);

comment on table public.payments is
  'Append-only payment ledger. Corrections are voids plus a new row, never edits.';
comment on column public.payments.received_by is
  'Set from auth.uid() server-side. Never user-selectable.';

-- At most one live downpayment and one live full payment per booking. These are
-- what let the logbook LEFT JOIN to exactly one row per column pair instead of
-- aggregating. Voided rows are excluded, so a correction is: void, then re-add.
create unique index payments_one_live_down_idx
  on public.payments (booking_id)
  where kind = 'down_payment' and voided_at is null;

create unique index payments_one_live_full_idx
  on public.payments (booking_id)
  where kind = 'full_payment' and voided_at is null;

create index payments_booking_idx on public.payments (booking_id);
create index payments_paid_on_idx on public.payments (paid_on) where voided_at is null;
create index payments_received_by_idx on public.payments (received_by);

-- ---------------------------------------------------------------------------
-- Keep bookings.amount_paid_cents and bookings.status in step with the ledger.
--
-- Derived-but-stored, deliberately. The month calendar has to paint yellow vs
-- green for a whole month of cells; doing that with a per-row aggregate over
-- payments would be a join and a group-by on every calendar render. Storing it
-- and maintaining it from one trigger keeps the read path a single index scan.
-- ---------------------------------------------------------------------------

create or replace function public.sync_booking_payment_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid := coalesce(new.booking_id, old.booking_id);
  v_paid       integer;
  v_total      integer;
  v_status     public.booking_status;
begin
  select coalesce(sum(p.amount_cents), 0)
    into v_paid
  from public.payments p
  where p.booking_id = v_booking_id
    and p.voided_at is null;

  select b.total_cents, b.status
    into v_total, v_status
  from public.bookings b
  where b.id = v_booking_id;

  -- Only the money-driven states are recomputed. A booking that has been
  -- cancelled, declined, expired or marked no_show keeps that status regardless
  -- of what the ledger says -- otherwise voiding a payment on a cancelled booking
  -- would quietly resurrect it.
  if v_status in ('pending', 'approved', 'downpayment', 'paid') then
    if v_total > 0 and v_paid >= v_total then
      v_status := 'paid';
    elsif v_paid > 0 then
      v_status := 'downpayment';
    elsif v_status in ('downpayment', 'paid') then
      -- Every payment was voided: fall back to approved, not pending. The admin
      -- already said yes, and that decision is not undone by a bookkeeping fix.
      v_status := 'approved';
    end if;
  end if;

  update public.bookings b
     set amount_paid_cents = v_paid,
         status            = v_status,
         -- A booking with money against it no longer needs a hold.
         hold_expires_at   = case when v_paid > 0 then null else b.hold_expires_at end
   where b.id = v_booking_id;

  return null;  -- AFTER trigger; return value is ignored
end;
$$;

create trigger payments_sync_booking
  after insert or update or delete on public.payments
  for each row execute function public.sync_booking_payment_state();
