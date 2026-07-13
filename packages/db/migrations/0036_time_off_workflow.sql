-- Wave 5 / task 25: complete the time-off approval lifecycle on the EXISTING
-- team_events.approval_status column (added in 0030). Adds a 'cancelled' state,
-- decision-audit columns, seeds the pending state for new employee requests, and
-- enforces transition rules at the data layer so the column is secure regardless
-- of how it is written: employees may only cancel their own pending/approved
-- request; managers may approve, decline, or cancel any.

alter table public.team_events
  drop constraint if exists team_events_approval_status_check;
alter table public.team_events
  add constraint team_events_approval_status_check
    check (approval_status in ('not_required','pending','approved','declined','cancelled'));

alter table public.team_events
  add column if not exists decided_by_staff_id uuid
    references public.staff (id) on delete set null,
  add column if not exists decided_at timestamptz;

comment on column public.team_events.approval_status is
  'Approval lifecycle for time_off events; not_required for other event types.';

-- 0030 uses column-level SELECT grants; authenticated must read the audit columns.
grant select (decided_by_staff_id, decided_at) on public.team_events to authenticated;
grant update (approval_status) on public.team_events to authenticated;

-- Existing employee time-off was stubbed to not_required; treat historical rows
-- as approved. New requests start pending via the superseded privacy trigger.
update public.team_events
set approval_status = 'approved'
where event_type = 'time_off' and approval_status = 'not_required';

-- Supersede the privacy trigger (0034) so it no longer clobbers approval_status
-- on every non-manager write, and seeds the lifecycle on insert instead.
create or replace function public.enforce_time_off_privacy()
returns trigger language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_name text;
begin
  if new.event_type = 'time_off' then
    select s.name into v_name from public.staff s where s.id = new.staff_id;
    new.title := coalesce(v_name, 'Team member') || ' unavailable';
    if new.description is not null then
      new.private_reason := new.description;
    end if;
    new.description := null;
    if not public.is_salon_manager() then
      new.manager_notes := null;
      new.visibility := 'team';
    end if;
    if tg_op = 'INSERT'
       and (new.approval_status is null or new.approval_status = 'not_required') then
      new.approval_status := case
        when public.is_salon_manager() then 'approved' else 'pending' end;
    end if;
  else
    new.approval_status := 'not_required';
  end if;
  return new;
end
$$;

-- Data-layer authorization for approval transitions. Fires before the privacy
-- trigger (alphabetical order) so decision metadata is stamped consistently.
create or replace function public.enforce_time_off_approval_transition()
returns trigger language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.approval_status is distinct from old.approval_status then
    if coalesce(new.event_type, old.event_type) <> 'time_off' then
      raise exception 'approval status applies only to time off' using errcode = '22023';
    end if;
    if new.approval_status not in ('pending','approved','declined','cancelled') then
      raise exception 'invalid approval status' using errcode = '22023';
    end if;

    if public.is_salon_manager() then
      null;
    elsif old.created_by_staff_id = public.current_staff_id()
          and old.staff_id = public.current_staff_id()
          and new.approval_status = 'cancelled'
          and old.approval_status in ('pending','approved') then
      null;
    else
      raise exception 'not allowed to change approval status' using errcode = '42501';
    end if;

    if new.approval_status in ('approved','declined') then
      new.decided_by_staff_id := public.current_staff_id();
      new.decided_at := now();
    else
      new.decided_by_staff_id := null;
      new.decided_at := null;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists team_events_approval_transition on public.team_events;
create trigger team_events_approval_transition
  before update on public.team_events
  for each row execute function public.enforce_time_off_approval_transition();