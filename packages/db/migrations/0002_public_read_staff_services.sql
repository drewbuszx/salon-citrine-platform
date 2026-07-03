-- Booking app reads staff_services with the anon key when filtering by professional.
-- Init migration only granted authenticated SELECT on this table.

create policy "Public read staff services"
  on public.staff_services for select
  using (
    exists (
      select 1
      from public.staff s
      where s.id = staff_services.staff_id
        and s.is_bookable = true
    )
    and exists (
      select 1
      from public.services svc
      where svc.id = staff_services.service_id
        and svc.is_active = true
        and svc.is_addon = false
    )
  );
