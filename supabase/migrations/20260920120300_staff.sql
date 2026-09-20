-- Staff accounts.
--
-- There is no public sign-up. An owner invites a staff member by email through the
-- Supabase Admin API; this table mirrors auth.users with the app-level role and an
-- active flag, and is populated by a trigger so the two can never diverge.
--
-- The active flag is what makes deactivation immediate. A revoked staffer's JWT may
-- stay technically valid until it expires, but every privileged query joins this
-- table, so the moment active flips to false they can do nothing.

create type public.staff_role as enum ('owner', 'staff');

create table public.staff (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  role       public.staff_role not null default 'staff',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.staff is
  'App-level profile for each auth user. Created automatically on invite acceptance.';
comment on column public.staff.active is
  'False revokes access on the next request, without waiting for the JWT to expire.';

create index staff_active_idx on public.staff (active) where active;

-- Mirror new auth users into staff. SECURITY DEFINER because the trigger runs as
-- the auth service, which has no rights on public.staff.
-- search_path is pinned to empty and every name fully qualified: a SECURITY DEFINER
-- function with a mutable search_path is a privilege-escalation vector.
create or replace function public.handle_new_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_staff();

-- ---------------------------------------------------------------------------
-- Authorisation helpers.
--
-- Used inside RLS policies. STABLE (not VOLATILE) so the planner can cache the
-- result per statement instead of re-running it for every row -- the difference
-- between a fast logbook page and a slow one.
-- ---------------------------------------------------------------------------

create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.staff s
  where s.id = (select auth.uid())
    and s.active;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    where s.id = (select auth.uid())
      and s.active
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    where s.id = (select auth.uid())
      and s.active
      and s.role = 'owner'
  );
$$;
