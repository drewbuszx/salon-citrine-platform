-- Allow providers to book and manage their own calendar (appointments + clients)

-- ---------------------------------------------------------------------------
-- clients — providers can read all clients for lookup and insert new ones
-- ---------------------------------------------------------------------------
create policy "Team read clients"
  on public.clients for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
  );

create policy "Providers insert clients"
  on public.clients for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
  );

-- ---------------------------------------------------------------------------
-- appointments — providers manage own column
-- ---------------------------------------------------------------------------
create policy "Providers insert own appointments"
  on public.appointments for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and staff_id = public.current_staff_id()
  );

create policy "Providers update own appointments"
  on public.appointments for update
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

-- ---------------------------------------------------------------------------
-- appointment_services — providers manage rows on own appointments
-- ---------------------------------------------------------------------------
create policy "Providers manage own appointment services"
  on public.appointment_services for all
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and exists (
      select 1
      from public.appointments a
      where a.id = appointment_services.appointment_id
        and a.staff_id = public.current_staff_id()
    )
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and exists (
      select 1
      from public.appointments a
      where a.id = appointment_services.appointment_id
        and a.staff_id = public.current_staff_id()
    )
  );
