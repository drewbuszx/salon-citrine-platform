-- Employee-management security and reliability hardening.
-- Additive migration: do not edit historical migrations.

alter table public.staff
  add column if not exists email text,
  add column if not exists access_status text not null default 'uninvited',
  add column if not exists auth_invited_at timestamptz,
  add column if not exists deactivated_at timestamptz;

alter table public.staff
  drop constraint if exists staff_access_status_check;
alter table public.staff
  add constraint staff_access_status_check
  check (access_status in ('uninvited', 'invited', 'active', 'disabled'));

create unique index if not exists staff_email_unique_idx
  on public.staff (lower(email))
  where email is not null;

update public.staff
set access_status = case
  when deactivated_at is not null then 'disabled'
  when supabase_user_id is not null then 'active'
  when auth_invited_at is not null then 'invited'
  else 'uninvited'
end;

create table if not exists public.staff_security_audit (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id uuid references public.staff(id) on delete set null,
  target_staff_id uuid references public.staff(id) on delete set null,
  action text not null check (
    action in ('staff_created', 'role_changed', 'invited', 'reinvited',
      'linked', 'deactivated', 'reactivated')
  ),
  before_state jsonb,
  after_state jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
alter table public.staff_security_audit enable row level security;
create policy "Managers read staff security audit"
  on public.staff_security_audit for select
  using (auth.role() = 'authenticated' and public.is_salon_manager());

create or replace function public.audit_staff_insert()
returns trigger language plpgsql security definer
set search_path = pg_catalog
as $$
begin
  insert into public.staff_security_audit(actor_staff_id,target_staff_id,action,after_state)
  values (public.current_staff_id(),new.id,'staff_created',
    jsonb_build_object('role',new.role,'email',new.email,'access_status',new.access_status));
  return new;
end
$$;
drop trigger if exists staff_security_insert_audit on public.staff;
create trigger staff_security_insert_audit
after insert on public.staff for each row execute function public.audit_staff_insert();

-- Active state is part of every principal lookup. Disabled and pending employees
-- cannot authorize through direct PostgREST access.
create or replace function public.current_staff_id()
returns uuid language sql stable security definer
set search_path = pg_catalog
as $$
  select s.id
  from public.staff as s
  where s.supabase_user_id = auth.uid()
    and s.access_status = 'active'
  limit 1
$$;

create or replace function public.current_staff_role()
returns text language sql stable security definer
set search_path = pg_catalog
as $$
  select s.role
  from public.staff as s
  where s.supabase_user_id = auth.uid()
    and s.access_status = 'active'
  limit 1
$$;

create or replace function public.is_salon_manager()
returns boolean language sql stable security definer
set search_path = pg_catalog
as $$
  select coalesce((
    select s.role in ('owner', 'front_desk')
    from public.staff as s
    where s.supabase_user_id = auth.uid()
      and s.access_status = 'active'
    limit 1
  ), false)
$$;

-- Remove whole-row self update. Safe profile changes go through one RPC.
drop policy if exists "Staff update own profile" on public.staff;
revoke update on public.staff from authenticated;

create or replace function public.update_own_staff_profile(
  p_name text,
  p_bio text default null,
  p_phone text default null
) returns public.staff
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_staff public.staff;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'name is required' using errcode = '22023'; end if;

  update public.staff
  set name = btrim(p_name),
      bio = nullif(btrim(p_bio), ''),
      phone = nullif(btrim(p_phone), '')
  where supabase_user_id = auth.uid()
    and access_status = 'active'
  returning * into v_staff;

  if not found then raise exception 'active staff profile not found' using errcode = '42501'; end if;
  return v_staff;
end
$$;
revoke all on function public.update_own_staff_profile(text, text, text) from public;
grant execute on function public.update_own_staff_profile(text, text, text) to authenticated;

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
  if p_updates - array['name','slug','role','bio','phone','email','is_bookable','accepting_new_clients'] <> '{}'::jsonb
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
      accepting_new_clients = case when p_updates ? 'accepting_new_clients' then (p_updates->>'accepting_new_clients')::boolean else accepting_new_clients end
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

-- Anonymous users get only the booking/marketing projection, never staff rows.
drop policy if exists "Public read bookable staff" on public.staff;
revoke select on public.staff from anon;
drop view if exists public.public_staff_profiles;
create view public.public_staff_profiles
with (security_barrier = true)
as
select id, slug, name,
       case when role = 'esthetician' then 'esthetician' else 'stylist' end as booking_role,
       bio, photo_url, photo_crop, glossgenius_token as booking_token,
       is_bookable, accepting_new_clients
from public.staff
where is_bookable = true
  and access_status <> 'disabled';
revoke all on public.public_staff_profiles from public;
grant select on public.public_staff_profiles to anon, authenticated;

-- Staff completion is atomic and cannot carry arbitrary task updates.
drop policy if exists "Staff complete assigned tasks" on public.tasks;
create or replace function public.complete_task(
  p_task_id uuid,
  p_completion_notes text default null
) returns public.tasks
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_staff_id uuid := public.current_staff_id();
  v_task public.tasks;
begin
  if v_staff_id is null then raise exception 'active staff required' using errcode = '42501'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;
  if v_task.status not in ('open','claimed') then raise exception 'task is closed' using errcode = '22023'; end if;
  if not public.is_salon_manager() and not exists (
    select 1 from public.task_assignees ta
    where ta.task_id = p_task_id and ta.staff_id = v_staff_id
  ) then raise exception 'not assigned' using errcode = '42501'; end if;

  update public.tasks
  set status = 'done', completed_at = now(), completed_by_staff_id = v_staff_id,
      completion_notes = nullif(btrim(p_completion_notes),'')
  where id = p_task_id returning * into v_task;
  return v_task;
end
$$;
revoke all on function public.complete_task(uuid, text) from public;
grant execute on function public.complete_task(uuid, text) to authenticated;

-- Private time-off details are separated from team-visible presentation.
alter table public.team_events
  add column if not exists private_reason text,
  add column if not exists manager_notes text,
  add column if not exists visibility text not null default 'team',
  add column if not exists approval_status text not null default 'not_required';
alter table public.team_events
  drop constraint if exists team_events_visibility_check,
  add constraint team_events_visibility_check check (visibility in ('team','managers')),
  drop constraint if exists team_events_approval_status_check,
  add constraint team_events_approval_status_check
    check (approval_status in ('not_required','pending','approved','declined'));

update public.team_events e
set private_reason = coalesce(private_reason, description),
    description = null,
    title = coalesce((select s.name || ' unavailable' from public.staff s where s.id = e.staff_id), 'Team member unavailable')
where event_type = 'time_off';

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
      new.private_reason := coalesce(new.private_reason, new.description);
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
drop trigger if exists team_events_time_off_privacy on public.team_events;
create trigger team_events_time_off_privacy
before insert or update on public.team_events
for each row execute function public.enforce_time_off_privacy();

revoke select on public.team_events from authenticated;
grant select (
  id,title,description,event_type,starts_at,ends_at,all_day,created_by_staff_id,
  staff_id,is_active,created_at,updated_at,visibility,approval_status
) on public.team_events to authenticated;

create or replace function public.get_private_event_details(p_event_id uuid)
returns table(private_reason text, manager_notes text)
language sql stable security definer
set search_path = pg_catalog
as $$
  select e.private_reason,
    case when public.is_salon_manager() then e.manager_notes else null end
  from public.team_events e
  where e.id = p_event_id
    and (public.is_salon_manager() or e.created_by_staff_id = public.current_staff_id())
$$;
revoke all on function public.get_private_event_details(uuid) from public;
grant execute on function public.get_private_event_details(uuid) to authenticated;

comment on view public.public_staff_profiles is
  'Approved anonymous booking projection. Never add contact, birthday, internal role, auth linkage, access state, or audit metadata.';
