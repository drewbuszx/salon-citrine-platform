-- Wave 2/3 identity and public-data safety:
--  * unique non-null staff.supabase_user_id (task 6)
--  * active linked-staff / manager helpers replace authenticated-only RLS (tasks 7, 8)
--  * booking_carts / booking_cart_items lose FOR ALL USING(true) (task 9)
--  * anonymous availability projection hides blocked_times.reason (tasks 10, 11)
--  * manager-only event visibility and private time-off reason semantics (tasks 13, 14)

do $$
begin
  if exists (
    select 1 from public.staff
    where supabase_user_id is not null
    group by supabase_user_id having count(*) > 1
  ) then
    raise exception 'duplicate staff.supabase_user_id values must be reconciled before migration';
  end if;
end
$$;
create unique index if not exists staff_supabase_user_id_unique_idx
  on public.staff(supabase_user_id) where supabase_user_id is not null;

create or replace function public.is_public_bookable_staff(p_staff_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.staff s
    where s.id = p_staff_id
      and s.is_bookable = true
      and s.access_status <> 'disabled'
  )
$$;
revoke all on function public.is_public_bookable_staff(uuid) from public;
grant execute on function public.is_public_bookable_staff(uuid) to anon, authenticated;

drop policy if exists "Public read staff services" on public.staff_services;
create policy "Public read staff services"
  on public.staff_services for select
  using (
    public.is_public_bookable_staff(staff_id)
    and exists (
      select 1 from public.services svc
      where svc.id = staff_services.service_id
        and svc.is_active = true and svc.is_addon = false
    )
  );

drop policy if exists "Public read blocked times for bookable staff" on public.blocked_times;
revoke select on public.blocked_times from anon;
drop view if exists public.public_blocked_intervals;
create view public.public_blocked_intervals
with (security_barrier = true)
as
select id, staff_id, starts_at, ends_at
from public.blocked_times
where public.is_public_bookable_staff(staff_id);
revoke all on public.public_blocked_intervals from public;
grant select on public.public_blocked_intervals to anon, authenticated;
comment on view public.public_blocked_intervals is
  'Public availability intervals only; blocked_times.reason is intentionally excluded.';

drop policy if exists "Public manage own booking carts by session" on public.booking_carts;
drop policy if exists "Public manage booking cart items" on public.booking_cart_items;
revoke all on public.booking_carts from anon, authenticated;
revoke all on public.booking_cart_items from anon, authenticated;

drop policy if exists "Public insert waitlist entries" on public.waitlist_entries;
drop policy if exists "Team read waitlist entries" on public.waitlist_entries;
revoke all on public.waitlist_entries from anon;
create policy "Managers read waitlist entries"
  on public.waitlist_entries for select
  using (public.is_salon_manager());

drop policy if exists "Staff read all staff" on public.staff;
create policy "Active staff read staff"
  on public.staff for select using (public.is_linked_staff());

drop policy if exists "Staff read all services" on public.services;
create policy "Active staff read all services"
  on public.services for select using (public.is_linked_staff());

drop policy if exists "Staff read staff services" on public.staff_services;
create policy "Active staff read staff services"
  on public.staff_services for select using (public.is_linked_staff());

drop policy if exists "Staff read logs" on public.email_logs;
drop policy if exists "Staff read sms logs" on public.sms_logs;
create policy "Managers read email logs"
  on public.email_logs for select using (public.is_salon_manager());
create policy "Managers read sms logs"
  on public.sms_logs for select using (public.is_salon_manager());

drop policy if exists "Team read active events" on public.team_events;
drop policy if exists "Managers read all events" on public.team_events;
create policy "Active staff read visible events"
  on public.team_events for select
  using (
    public.is_linked_staff()
    and (
      visibility = 'team'
      or public.is_salon_manager()
      or created_by_staff_id = public.current_staff_id()
    )
    and (is_active = true or public.is_salon_manager())
  );

create or replace function public.enforce_time_off_privacy()
returns trigger language plpgsql
set search_path = pg_catalog
as $$
declare v_name text;
begin
  if new.event_type = 'time_off' then
    select s.name into v_name from public.staff s where s.id = new.staff_id;
    new.title := coalesce(v_name, 'Team member') || ' unavailable';
    if new.description is not null then
      new.private_reason := new.description;
    end if;
    new.description := null;
    if not public.is_salon_manager() then
      new.manager_notes := null;
      new.visibility := 'team';
      new.approval_status := 'not_required';
    end if;
  end if;
  return new;
end
$$;
