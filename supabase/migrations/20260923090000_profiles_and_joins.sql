-- Member profiles, avatars, "who's playing", and joining a session.
--
-- Until now the public calendar showed WHEN the court was busy and never WHO.
-- Members change that, deliberately and only for themselves: a member's booking
-- can show their name and photo, and other members can join it. Guests -- people
-- who booked over Messenger without an account -- still appear only as "Booked".
-- Nothing here ever exposes a customer's contact details.

-- ---------------------------------------------------------------------------
-- 1. Profiles: what a member chooses to show. One row per auth user, created by
--    trigger, editable only by its owner (staff may read, for the admin).
-- ---------------------------------------------------------------------------

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null check (length(trim(display_name)) between 1 and 60),
  avatar_url       text,
  -- Off means "book like a guest": no name or photo on the calendar, ever.
  show_on_calendar boolean not null default true,
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is
  'Member display name, photo and calendar visibility. Edited on /account.';

grant select, insert, update on public.profiles to authenticated;
alter table public.profiles enable row level security;

create policy profiles_read_own_or_staff on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'picture'), '')   -- Google's key
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_profile();

-- Existing users (the admin accounts) get a profile too.
insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    split_part(u.email, '@', 1)
  ),
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'picture'), '')
  )
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Avatars: a public bucket, each member confined to their own folder.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy avatars_public_read on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- 3. Joining a session. Inserts go through join_booking() so the rules live in
--    one place; leaving is a plain delete of your own row.
-- ---------------------------------------------------------------------------

create table public.booking_participants (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (booking_id, profile_id)
);

comment on table public.booking_participants is
  'Members who joined a booked session. The host is the booking''s customer_email.';

grant select, delete on public.booking_participants to authenticated;
alter table public.booking_participants enable row level security;

create policy participants_read_own_or_staff on public.booking_participants
  for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_staff()));

create policy participants_leave_own on public.booking_participants
  for delete to authenticated
  using (profile_id = (select auth.uid()));

-- The member who made the booking: the account whose email staff filed it under.
create or replace function public.booking_host_id(p_booking_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.bookings b
  join auth.users u on lower(u.email) = lower(b.customer_email)
  where b.id = p_booking_id
  limit 1;
$$;

revoke all on function public.booking_host_id(uuid) from public, anon, authenticated;

-- Room for doubles and a bench: host + 7.
create or replace function public.join_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_b     public.bookings%rowtype;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  select * into v_b from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_b.status not in ('approved', 'downpayment', 'paid') then
    raise exception 'NOT_JOINABLE';
  end if;
  if v_b.booking_date < v_today then
    raise exception 'DATE_PAST';
  end if;
  if public.booking_host_id(p_booking_id) = v_uid then
    raise exception 'IS_HOST';
  end if;
  if (select count(*) from public.booking_participants p where p.booking_id = p_booking_id) >= 7 then
    raise exception 'SESSION_FULL';
  end if;

  insert into public.booking_participants (booking_id, profile_id)
  values (p_booking_id, v_uid)
  on conflict do nothing;
end;
$$;

create or replace function public.leave_booking(p_booking_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.booking_participants
  where booking_id = p_booking_id
    and profile_id = (select auth.uid());
$$;

grant execute on function public.join_booking(uuid)  to authenticated;
grant execute on function public.leave_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The public projection: who is playing on a date. Confirmed sessions only;
--    names and photos only for members who left show_on_calendar on. Never a
--    contact detail, never a guest's name. `joined` / `is_host` are computed for
--    the caller, and are simply false for anonymous visitors.
-- ---------------------------------------------------------------------------

create or replace function public.get_day_roster(p_date date)
returns table (
  booking_id        uuid,
  start_hour        smallint,
  end_hour          smallint,
  status            text,
  host_name         text,
  host_avatar       text,
  participants      json,
  participant_count integer,
  joined            boolean,
  is_host           boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    extract(hour from b.start_time)::smallint,
    (case when b.end_time = time '24:00' then 24
          else extract(hour from b.end_time) end)::smallint,
    b.status::text,
    case when hp.show_on_calendar then hp.display_name end,
    case when hp.show_on_calendar then hp.avatar_url end,
    coalesce((
      select json_agg(json_build_object('name', pp.display_name, 'avatar', pp.avatar_url)
                      order by bp.created_at)
      from public.booking_participants bp
      join public.profiles pp on pp.id = bp.profile_id
      where bp.booking_id = b.id and pp.show_on_calendar
    ), '[]'::json),
    (select count(*)::integer from public.booking_participants bp where bp.booking_id = b.id),
    exists (
      select 1 from public.booking_participants bp
      where bp.booking_id = b.id and bp.profile_id = (select auth.uid())
    ),
    (hu.id is not null and hu.id = (select auth.uid()))
  from public.bookings b
  left join auth.users hu
         on b.customer_email is not null and lower(hu.email) = lower(b.customer_email)
  left join public.profiles hp on hp.id = hu.id
  where b.booking_date = p_date
    and b.status in ('approved', 'downpayment', 'paid')
  order by b.start_time;
$$;

grant execute on function public.get_day_roster(date) to anon, authenticated;
