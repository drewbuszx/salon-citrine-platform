-- Per stylist+service: hide or block from client online booking.
-- Team manual booking ignores these blocks (shows all staff_services).

create type public.client_booking_block as enum ('none', 'soft', 'hard');

alter table public.staff_services
  add column if not exists client_booking_block public.client_booking_block not null default 'none';

-- ---------------------------------------------------------------------------
-- staff_schedules — stylists manage own rows; managers manage all
-- (Public read policy from 0001_init remains for client availability)
-- ---------------------------------------------------------------------------
create policy "Stylists manage own schedules"
  on public.staff_schedules for all
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and staff_id = public.current_staff_id()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and staff_id = public.current_staff_id()
  );

create policy "Managers manage staff schedules"
  on public.staff_schedules for all
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );
