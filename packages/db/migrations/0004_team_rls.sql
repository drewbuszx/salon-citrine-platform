-- Team app RLS — role-scoped access for authenticated staff
-- Owners and front desk: full salon calendar, block time for anyone, edit services
-- Stylists / estheticians: own appointments and blocked time only

-- ---------------------------------------------------------------------------
-- Helper functions (security definer — read staff linked to auth.uid())
-- ---------------------------------------------------------------------------
create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.staff
  where supabase_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.staff
  where supabase_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_salon_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role in ('owner', 'front_desk')
      from public.staff
      where supabase_user_id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.is_linked_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_id() is not null;
$$;

revoke all on function public.current_staff_id() from public;
revoke all on function public.current_staff_role() from public;
revoke all on function public.is_salon_manager() from public;
revoke all on function public.is_linked_staff() from public;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_salon_manager() to authenticated;
grant execute on function public.is_linked_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- Drop broad Phase 1 staff policies (replaced below)
-- ---------------------------------------------------------------------------
drop policy if exists "Staff manage appointments" on public.appointments;
drop policy if exists "Staff manage appointment_services" on public.appointment_services;
drop policy if exists "Staff manage clients" on public.clients;
drop policy if exists "Staff manage blocked times" on public.blocked_times;

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create policy "Team read appointments"
  on public.appointments for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or staff_id = public.current_staff_id()
    )
  );

create policy "Managers manage appointments"
  on public.appointments for all
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

-- ---------------------------------------------------------------------------
-- appointment_services (follow appointment visibility / manager writes)
-- ---------------------------------------------------------------------------
create policy "Team read appointment services"
  on public.appointment_services for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and exists (
      select 1
      from public.appointments a
      where a.id = appointment_services.appointment_id
        and (
          public.is_salon_manager()
          or a.staff_id = public.current_staff_id()
        )
    )
  );

create policy "Managers manage appointment services"
  on public.appointment_services for all
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

-- ---------------------------------------------------------------------------
-- clients (managers full access; providers read clients on own appointments)
-- ---------------------------------------------------------------------------
create policy "Team read clients for own appointments"
  on public.clients for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and exists (
      select 1
      from public.appointments a
      where a.client_id = clients.id
        and a.staff_id = public.current_staff_id()
    )
  );

create policy "Managers manage clients"
  on public.clients for all
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

-- ---------------------------------------------------------------------------
-- blocked_times
-- ---------------------------------------------------------------------------
create policy "Team read blocked times"
  on public.blocked_times for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or staff_id = public.current_staff_id()
    )
  );

create policy "Team insert blocked times"
  on public.blocked_times for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or staff_id = public.current_staff_id()
    )
  );

create policy "Team update blocked times"
  on public.blocked_times for update
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or staff_id = public.current_staff_id()
    )
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or staff_id = public.current_staff_id()
    )
  );

create policy "Team delete blocked times"
  on public.blocked_times for delete
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or staff_id = public.current_staff_id()
    )
  );

-- ---------------------------------------------------------------------------
-- services — managers may update duration_minutes (and related fields)
-- ---------------------------------------------------------------------------
create policy "Managers update services"
  on public.services for update
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );
