-- Wave 5 / task 23: richer employee profiles.
--
-- staff.bio and staff.phone already exist (0001/0006); this migration adds the
-- one genuinely new team-visible field (start_date) and isolates sensitive
-- emergency-contact data in a dedicated table.
--
-- Split by sensitivity so RLS stays column-safe:
--  * start_date lives on public.staff and is team-visible; managers write it via
--    the superseded manager_update_staff RPC below.
--  * emergency contact details are personal data and are isolated in a dedicated
--    table so only the employee themselves and salon managers can read/write them.
--    Postgres RLS is row-scoped, so a separate table is the correct way to keep
--    these fields off the team-wide staff read policy.

alter table public.staff
  add column if not exists start_date date;

comment on column public.staff.start_date is
  'Employment start date; team-visible tenure marker set by managers.';

-- Supersede manager_update_staff (0030) so managers may also set start_date.
create or replace function public.manager_update_staff(
  p_staff_id uuid,
  p_updates jsonb,
  p_request_id text default null
) returns public.staff
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_before public.staff;
  v_after public.staff;
  v_role text;
begin
  if not public.is_salon_manager() then raise exception 'manager required' using errcode = '42501'; end if;
  if p_updates - array['name','slug','role','bio','phone','email','is_bookable','accepting_new_clients','start_date'] <> '{}'::jsonb
    then raise exception 'unsupported staff field' using errcode = '22023';
  end if;

  select * into v_before from public.staff where id = p_staff_id for update;
  if not found then raise exception 'staff not found' using errcode = 'P0002'; end if;
  v_role := coalesce(p_updates->>'role', v_before.role);
  if v_role not in ('owner','front_desk','stylist','esthetician') then
    raise exception 'invalid role' using errcode = '22023';
  end if;

  update public.staff
  set name = case when p_updates ? 'name' then nullif(btrim(p_updates->>'name'),'') else name end,
      slug = case when p_updates ? 'slug' then nullif(btrim(p_updates->>'slug'),'') else slug end,
      role = v_role,
      bio = case when p_updates ? 'bio' then nullif(btrim(p_updates->>'bio'),'') else bio end,
      phone = case when p_updates ? 'phone' then nullif(btrim(p_updates->>'phone'),'') else phone end,
      email = case when p_updates ? 'email' then nullif(lower(btrim(p_updates->>'email')),'') else email end,
      is_bookable = case when p_updates ? 'is_bookable' then (p_updates->>'is_bookable')::boolean else is_bookable end,
      accepting_new_clients = case when p_updates ? 'accepting_new_clients' then (p_updates->>'accepting_new_clients')::boolean else accepting_new_clients end,
      start_date = case when p_updates ? 'start_date' then nullif(btrim(p_updates->>'start_date'),'')::date else start_date end
  where id = p_staff_id returning * into v_after;

  if v_before.role is distinct from v_after.role then
    insert into public.staff_security_audit(actor_staff_id,target_staff_id,action,before_state,after_state,request_id)
    values (public.current_staff_id(),p_staff_id,'role_changed',
      jsonb_build_object('role',v_before.role),jsonb_build_object('role',v_after.role),p_request_id);
  end if;
  return v_after;
end
$$;
revoke all on function public.manager_update_staff(uuid, jsonb, text) from public;
grant execute on function public.manager_update_staff(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- staff_private_details — sensitive emergency-contact data, strict RLS.
-- ---------------------------------------------------------------------------
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