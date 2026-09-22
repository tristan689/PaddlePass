-- Customer accounts (Google sign-in).
--
-- Customers can now sign in with Google to see their own bookings. That changes
-- one assumption baked into the staff trigger: until now, every new auth user was
-- staff, because the only way in was an invite. With public sign-in, that trigger
-- would hand every customer the admin. Fixed first, before anything else here.

-- ---------------------------------------------------------------------------
-- 1. Only users created WITH a role become staff.
--
-- Invites (src/app/admin/staff/actions.ts) and scripts/create-staff.mjs both set
-- `role` in the user metadata. Google sign-ups never do. A user created from the
-- Supabase dashboard without metadata is now a customer, not staff -- use the
-- script, or insert the public.staff row by hand.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ? 'role' then
    insert into public.staff (id, full_name, role)
    values (
      new.id,
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        split_part(new.email, '@', 1)
      ),
      coalesce(
        (new.raw_user_meta_data ->> 'role')::public.staff_role,
        'staff'::public.staff_role
      )
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. A booking can carry the customer's account email.
--
-- Staff type it in from the Messenger conversation (the customer's opening
-- message includes it when they are signed in). It is what links a booking to
-- "My bookings"; matching on a name would be guesswork.
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column if not exists customer_email text;

comment on column public.bookings.customer_email is
  'Account email of the customer, if known. Links the booking to their /account page.';

create index if not exists bookings_customer_email_idx
  on public.bookings (lower(customer_email))
  where customer_email is not null;

-- ---------------------------------------------------------------------------
-- 3. Customers read their own bookings.
--
-- Permissive alongside bookings_staff_read: staff still see everything, a
-- customer sees rows tagged with their email and nothing else. No insert,
-- update or delete -- customers never write to bookings.
-- ---------------------------------------------------------------------------

create policy bookings_customer_read on public.bookings
  for select to authenticated
  using (
    customer_email is not null
    and lower(customer_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

-- ---------------------------------------------------------------------------
-- 4. create_staff_booking learns the email. Postgres cannot add a parameter with
--    CREATE OR REPLACE, so the old signature is dropped and re-created.
-- ---------------------------------------------------------------------------

drop function if exists public.create_staff_booking(
  date, smallint, smallint, smallint, text, text, text, text
);

create or replace function public.create_staff_booking(
  p_date           date,
  p_start_hour     smallint,
  p_end_hour       smallint,
  p_paddle_count   smallint,
  p_customer_name  text,
  p_contact        text,
  p_facebook_name  text,
  p_note           text default null,
  p_customer_email text default null
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

  perform pg_advisory_xact_lock(hashtext('paddlepass:1:' || p_date::text));

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
      customer_name, contact, facebook_name, customer_note, customer_email,
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
      nullif(lower(trim(coalesce(p_customer_email, ''))), ''),
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
  date, smallint, smallint, smallint, text, text, text, text, text
) to authenticated;
