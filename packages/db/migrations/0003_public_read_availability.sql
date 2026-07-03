-- Booking app (anon key) needs blocked times and appointment conflicts for availability.
-- staff_schedules already has "Public read staff schedules" from 0001_init.

-- blocked_times: read-only for bookable staff (no write for anon)
create policy "Public read blocked times for bookable staff"
  on public.blocked_times for select
  using (
    exists (
      select 1
      from public.staff s
      where s.id = blocked_times.staff_id
        and s.is_bookable = true
    )
  );

-- Minimal appointment conflict data — no client PII exposed to anon.
create view public.appointment_availability as
select
  staff_id,
  starts_at,
  ends_at,
  status
from public.appointments
where status in ('pending', 'confirmed');

grant select on public.appointment_availability to anon, authenticated;
