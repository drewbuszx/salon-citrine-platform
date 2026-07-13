-- Wave 5 / task 23: richer employee profiles.
--
-- Split by sensitivity so RLS stays column-safe:
--  * bio + start_date live on public.staff and are team-visible (managers write via
--    the existing "Managers update staff" policy from 0028).
--  * emergency contact details are personal data and are isolated in a dedicated
--    table so only the employee themselves and salon managers can read/write them.
--    Postgres RLS is row-scoped, so a separate table is the correct way to keep
--    these fields off the team-wide staff read policy.

alter table public.staff
  add column if not exists bio text,
  add column if not exists start_date date;

comment on column public.staff.bio is
  'Short team-visible biography shown on the employee profile.';
comment on column public.staff.start_date is
  'Employment start date; team-visible tenure marker.';

create table if not exists public.staff_private_details (
  staff_id uuid primary key references public.staff (id) on delete cascade,
  emergency_contact_name text,
  emergency_contact_phone text,
  updated_at timestamptz not null default now()
);

comment on table public.staff_private_details is
  'Sensitive per-employee details (emergency contacts). Readable only by the employee themselves and salon managers via RLS.';

drop trigger if exists staff_private_details_updated_at on public.staff_private_details;
create trigger staff_private_details_updated_at
  before update on public.staff_private_details
  for each row execute function public.set_updated_at();

alter table public.staff_private_details enable row level security;

create policy "Employee reads own private details"
  on public.staff_private_details for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and staff_id = public.current_staff_id()
  );

create policy "Employee upserts own private details"
  on public.staff_private_details for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and staff_id = public.current_staff_id()
  );

create policy "Employee updates own private details"
  on public.staff_private_details for update
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

create policy "Managers manage private details"
  on public.staff_private_details for all
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

revoke all on public.staff_private_details from anon;
grant select, insert, update on public.staff_private_details to authenticated;