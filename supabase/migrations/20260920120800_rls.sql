-- Row Level Security.
--
-- THE PRIVACY REQUIREMENT, stated plainly: an anonymous visitor must be able to see
-- WHEN the court is busy, and must never be able to see WHO booked it. Names,
-- phone numbers and Facebook handles are not public data.
--
-- The strategy is deny-by-default at the GRANT layer, not just the policy layer:
--   * `anon` gets NO table privileges whatsoever. Not "select with a policy" --
--     none. A policy bug therefore cannot leak anything, because PostgREST will
--     refuse the request before RLS is ever consulted.
--   * Everything the public needs comes from SECURITY DEFINER functions that
--     return only date / time / state, and are individually granted to anon.
--   * `authenticated` gets ordinary table privileges, and RLS narrows them to
--     active staff.
--
-- Note on performance: every policy wraps its helper in `(select ...)`. That turns
-- a per-row function call into a single InitPlan evaluated once per statement.
-- Without it, the logbook re-checks staff membership for every row it returns.

-- ---------------------------------------------------------------------------
-- Baseline: revoke the blanket grants Supabase applies to new tables.
-- ---------------------------------------------------------------------------

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke all on all functions in schema public from authenticated;

-- Anything created later inherits the same denial until granted on purpose.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------------
-- Staff get ordinary table access; RLS decides which rows.
-- ---------------------------------------------------------------------------

grant select, insert, update on public.settings             to authenticated;
grant select                 on public.staff                to authenticated;
grant update                 on public.staff                to authenticated;
grant select, insert, update, delete on public.blocked_dates to authenticated;
grant select, insert, update, delete on public.bookings      to authenticated;
grant select, insert, update on public.payments              to authenticated;
grant select, insert on public.booking_reschedules           to authenticated;

alter table public.settings             enable row level security;
alter table public.staff                enable row level security;
alter table public.blocked_dates        enable row level security;
alter table public.bookings             enable row level security;
alter table public.payments             enable row level security;
alter table public.booking_reschedules  enable row level security;

-- NOT using `force row level security` here, deliberately.
--
-- FORCE subjects the table OWNER to these policies too. That sounds like a useful
-- extra guard, but the payment-sync trigger in 20260920120600_payments.sql is
-- SECURITY DEFINER and updates public.bookings as the owner. Whether that still
-- works depends on whether the owning role happens to carry BYPASSRLS, which is a
-- deployment detail we should not be betting the payment ledger on -- the failure
-- mode is a silent zero-row update, so a booking would take a payment and never
-- turn yellow.
--
-- The boundary that actually matters is `anon` and `authenticated`, and both are
-- fully covered by the grants and policies above.

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------

create policy settings_staff_read on public.settings
  for select to authenticated
  using ((select public.is_staff()));

-- Owner-only: hours and rates change what customers are charged.
create policy settings_owner_write on public.settings
  for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------

create policy staff_read_all on public.staff
  for select to authenticated
  using ((select public.is_staff()));

-- Owners manage the roster. Rows are created by the auth.users trigger, which is
-- SECURITY DEFINER and therefore not subject to these policies.
create policy staff_owner_manage on public.staff
  for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- blocked_dates
-- ---------------------------------------------------------------------------

create policy blocked_dates_staff_all on public.blocked_dates
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- bookings
--
-- No anon policy exists, and no anon grant exists. Public submissions arrive
-- through public.create_booking(), which is SECURITY DEFINER.
-- ---------------------------------------------------------------------------

create policy bookings_staff_read on public.bookings
  for select to authenticated
  using ((select public.is_staff()));

create policy bookings_staff_write on public.bookings
  for insert to authenticated
  with check ((select public.is_staff()));

create policy bookings_staff_update on public.bookings
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- Deleting a booking destroys the audit trail. Cancel it instead. Owners keep the
-- ability purely for cleaning up test data.
create policy bookings_owner_delete on public.bookings
  for delete to authenticated
  using ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

create policy payments_staff_read on public.payments
  for select to authenticated
  using ((select public.is_staff()));

-- The attribution requirement, enforced in the database rather than trusted to the
-- form: a staff member can only ever record a payment as themselves.
create policy payments_insert_as_self on public.payments
  for insert to authenticated
  with check (
    (select public.is_staff())
    and received_by = (select auth.uid())
  );

-- Update exists solely to void. There is no delete policy and no delete grant,
-- so a payment can never leave the ledger.
create policy payments_staff_void on public.payments
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- booking_reschedules
-- ---------------------------------------------------------------------------

create policy reschedules_staff_read on public.booking_reschedules
  for select to authenticated
  using ((select public.is_staff()));

create policy reschedules_staff_insert on public.booking_reschedules
  for insert to authenticated
  with check ((select public.is_staff()));
