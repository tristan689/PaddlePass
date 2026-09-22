-- get_day_roster: `is_host` must be a real boolean for anonymous callers.
-- `hu.id = auth.uid()` is NULL when there is no session, and `true AND NULL` is
-- NULL, so the public projection returned is_host = null instead of false.
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
    coalesce(hu.id = (select auth.uid()), false)
  from public.bookings b
  left join auth.users hu
         on b.customer_email is not null and lower(hu.email) = lower(b.customer_email)
  left join public.profiles hp on hp.id = hu.id
  where b.booking_date = p_date
    and b.status in ('approved', 'downpayment', 'paid')
  order by b.start_time;
$$;
