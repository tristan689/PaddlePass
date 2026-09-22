-- Pre-approved staff emails.
--
-- With Google sign-in, a staffer's first visit creates their auth user with no
-- metadata -- there is no invite step to carry a role. This table is that step:
-- an owner lists the email in advance, and whoever signs in with it (Google or
-- password) gets a staff row at the listed role. It also lets an owner promote a
-- customer who signed in first and was approved later.

create table public.staff_allowlist (
  email      text primary key check (email = lower(email)),
  full_name  text,
  role       public.staff_role not null default 'staff',
  added_by   uuid references public.staff (id),
  created_at timestamptz not null default now()
);

comment on table public.staff_allowlist is
  'Emails that become staff on sign-in. Managed by owners on /admin/staff.';

grant select, insert, delete on public.staff_allowlist to authenticated;
alter table public.staff_allowlist enable row level security;

create policy allowlist_owner_all on public.staff_allowlist
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- New auth users: staff if the sign-up carried a role (invites, the script) OR
-- the email is pre-approved. Everyone else is a customer.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allow public.staff_allowlist%rowtype;
  v_listed boolean;
begin
  select * into v_allow from public.staff_allowlist a where a.email = lower(new.email);
  v_listed := found;

  if (new.raw_user_meta_data ? 'role') or v_listed then
    insert into public.staff (id, full_name, role)
    values (
      new.id,
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),   -- Google's key
        v_allow.full_name,
        split_part(new.email, '@', 1)
      ),
      coalesce(
        (new.raw_user_meta_data ->> 'role')::public.staff_role,
        v_allow.role,
        'staff'::public.staff_role
      )
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Promote users who already exist. Called right after an owner adds an email,
-- and once here. SECURITY DEFINER because it reads auth.users; it can only ever
-- promote emails an owner put on the list, so exposing it to `authenticated` is
-- safe. Never updates an existing staff row -- adding someone twice must not
-- silently change their role or reactivate them.
-- ---------------------------------------------------------------------------

create or replace function public.sync_staff_from_allowlist()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.staff (id, full_name, role)
  select
    u.id,
    coalesce(
      a.full_name,
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
      split_part(u.email, '@', 1)
    ),
    a.role
  from auth.users u
  join public.staff_allowlist a on a.email = lower(u.email)
  on conflict (id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.sync_staff_from_allowlist() from public, anon;
grant execute on function public.sync_staff_from_allowlist() to authenticated;

-- The super admin. Owner is the top role: settings, roster, everything.
insert into public.staff_allowlist (email, full_name, role)
values ('tristandeguzman52@gmail.com', 'Tristan de Guzman', 'owner')
on conflict (email) do update set role = 'owner';

select public.sync_staff_from_allowlist();
