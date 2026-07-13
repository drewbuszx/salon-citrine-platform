-- Wave 5 / task 24: bounded role-capability model with an owner anti-lockout floor.
--
-- HIGHEST-RISK migration in the employee-platform program: it rewrites
-- public.is_salon_manager(), which backs 20+ RLS policies and security-definer
-- functions. Owners are a hard-coded manager floor so a capability toggle can
-- never lock every manager out. The runtime behavior of the rewritten function
-- and every dependent policy MUST be proven by the deferred disposable-DB replay
-- + pgTAP gate before deploy.

-- 1. Bounded capability catalog. The editor can only toggle capabilities that
--    exist here; it can never invent new permissions.
create table if not exists public.capabilities (
  key text primary key,
  label text not null,
  description text not null,
  sort_order integer not null default 0
);
alter table public.capabilities enable row level security;
drop policy if exists "Active staff read capabilities" on public.capabilities;
create policy "Active staff read capabilities"
  on public.capabilities for select
  using (public.is_linked_staff());
revoke all on public.capabilities from anon;
grant select on public.capabilities to authenticated;

-- 2. Role -> capability grants. Presence of a row means the capability is granted.
create table if not exists public.role_capabilities (
  role text not null,
  capability text not null references public.capabilities(key) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by_staff_id uuid references public.staff(id) on delete set null,
  primary key (role, capability),
  constraint role_capabilities_role_check
    check (role in ('owner', 'stylist', 'esthetician', 'front_desk'))
);
alter table public.role_capabilities enable row level security;
drop policy if exists "Active staff read role capabilities" on public.role_capabilities;
create policy "Active staff read role capabilities"
  on public.role_capabilities for select
  using (public.is_linked_staff());
-- No direct writes: every mutation goes through the owner-gated RPC below.
revoke all on public.role_capabilities from anon;
grant select on public.role_capabilities to authenticated;

-- 3. Seed the bounded catalog.
insert into public.capabilities (key, label, description, sort_order) values
  ('manage_team', 'Manage team',
    'Add, invite, edit, and deactivate employees; change roles, profiles, schedules, and every other manager-only setting. This is the core manager permission.',
    10),
  ('view_activity', 'View activity log',
    'Read the security activity log of employee, role, and access changes.',
    20)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      sort_order = excluded.sort_order;

-- 4. Seed grants that reproduce today's behavior exactly: owner + front_desk are
--    managers and can view activity.
insert into public.role_capabilities (role, capability) values
  ('owner', 'manage_team'),
  ('owner', 'view_activity'),
  ('front_desk', 'manage_team'),
  ('front_desk', 'view_activity')
on conflict do nothing;

-- 5. Capability check with the owner anti-lockout floor for manage_team.
create or replace function public.staff_has_capability(p_capability text)
returns boolean language sql stable security definer
set search_path = pg_catalog
as $$
  select coalesce((
    select
      (p_capability = 'manage_team' and s.role = 'owner')
      or exists (
        select 1 from public.role_capabilities rc
        where rc.role = s.role and rc.capability = p_capability
      )
    from public.staff as s
    where s.supabase_user_id = auth.uid()
      and s.access_status = 'active'
    limit 1
  ), false)
$$;
revoke all on function public.staff_has_capability(text) from public, anon;
grant execute on function public.staff_has_capability(text) to authenticated;

-- 6. Rewrite is_salon_manager to read the manage_team capability. The owner floor
--    lives in staff_has_capability, so owners are always managers.
create or replace function public.is_salon_manager()
returns boolean language sql stable security definer
set search_path = pg_catalog
as $$
  select public.staff_has_capability('manage_team')
$$;

-- 7. Extend the audit action vocabulary for capability changes.
alter table public.staff_security_audit
  drop constraint if exists staff_security_audit_action_check;
alter table public.staff_security_audit
  add constraint staff_security_audit_action_check
  check (action in ('staff_created', 'role_changed', 'invited', 'reinvited',
    'linked', 'deactivated', 'reactivated', 'capability_changed'));

-- 8. Owner-only, audited capability editor RPC with anti-lockout enforcement.
create or replace function public.set_role_capability(
  p_role text, p_capability text, p_enabled boolean
) returns void language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := public.current_staff_id();
begin
  if public.current_staff_role() <> 'owner' then
    raise exception 'owner required' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'stylist', 'esthetician', 'front_desk') then
    raise exception 'unknown role' using errcode = '22023';
  end if;
  if not exists (select 1 from public.capabilities where key = p_capability) then
    raise exception 'unknown capability' using errcode = '22023';
  end if;
  -- Anti-lockout: owners must always retain manage_team.
  if p_capability = 'manage_team' and p_role = 'owner' and not p_enabled then
    raise exception 'owners must retain manage_team' using errcode = '42501';
  end if;

  if p_enabled then
    insert into public.role_capabilities (role, capability, granted_by_staff_id)
    values (p_role, p_capability, v_actor)
    on conflict (role, capability)
      do update set granted_by_staff_id = v_actor, granted_at = now();
  else
    delete from public.role_capabilities
    where role = p_role and capability = p_capability;
  end if;

  insert into public.staff_security_audit (actor_staff_id, action, after_state)
  values (v_actor, 'capability_changed',
    jsonb_build_object('role', p_role, 'capability', p_capability, 'enabled', p_enabled));
end
$$;
revoke all on function public.set_role_capability(text, text, boolean) from public, anon;
grant execute on function public.set_role_capability(text, text, boolean) to authenticated;

-- 9. Move the audit-log read policy onto the view_activity capability so the
--    editor genuinely governs a second, independent permission.
drop policy if exists "Managers read staff security audit" on public.staff_security_audit;
drop policy if exists "Activity viewers read staff security audit" on public.staff_security_audit;
create policy "Activity viewers read staff security audit"
  on public.staff_security_audit for select
  using (auth.role() = 'authenticated' and public.staff_has_capability('view_activity'));