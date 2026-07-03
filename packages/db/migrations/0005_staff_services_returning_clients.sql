-- Per stylist+service: restrict booking to returning clients only
-- Team app: stylists update own rows; managers update all

alter table public.staff_services
  add column if not exists returning_clients_only boolean not null default false;

-- ---------------------------------------------------------------------------
-- staff_services — team may update returning_clients_only
-- ---------------------------------------------------------------------------
create policy "Stylists update own staff services"
  on public.staff_services for update
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

create policy "Managers update staff services"
  on public.staff_services for update
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );
