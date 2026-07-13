-- Wave 1 corrective hardening: secure invite confirmation and atomic task claim.

-- Invite confirmation must derive its subject from server-controlled database
-- state and the authenticated Auth UUID, never from mutable user_metadata. It only
-- activates a staff row that is genuinely pending (access_status = 'invited'), whose
-- linked Auth UUID and email match, and for which a real invitation audit exists.
-- It is idempotent for already-active linkage and refuses to touch disabled or
-- uninvited rows, so recovery/magic-link callbacks cannot silently reactivate access.
create or replace function public.confirm_staff_invite(
  p_auth_user_id uuid,
  p_email text,
  p_request_id text default null
) returns uuid
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_before public.staff;
  v_actor uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_auth_user_id is null then
    raise exception 'auth user id required' using errcode = '22023';
  end if;

  select * into v_before from public.staff
  where supabase_user_id = p_auth_user_id
  for update;
  if not found then
    return null; -- Authenticated user is not a linked staff member; nothing to do.
  end if;

  if v_before.access_status = 'active' then
    return v_before.id; -- Idempotent: confirmation was already completed.
  end if;
  if v_before.access_status <> 'invited' then
    return null; -- Never activate disabled/uninvited rows from a callback.
  end if;
  if lower(coalesce(v_before.email, '')) <> lower(coalesce(p_email, '')) then
    raise exception 'invite email mismatch' using errcode = '42501';
  end if;

  select a.actor_staff_id into v_actor
  from public.staff_security_audit a
  where a.target_staff_id = v_before.id
    and a.action in ('invited','reinvited')
    and a.after_state ->> 'supabase_user_id' = p_auth_user_id::text
  order by a.created_at desc
  limit 1;
  if v_actor is null then
    raise exception 'no matching invitation audit' using errcode = '42501';
  end if;

  update public.staff
  set access_status = 'active',
      deactivated_at = null
  where id = v_before.id;

  insert into public.staff_security_audit(
    actor_staff_id, target_staff_id, action, before_state, after_state, request_id
  ) values (
    v_actor, v_before.id, 'linked',
    jsonb_build_object('access_status', v_before.access_status,
                       'supabase_user_id', v_before.supabase_user_id),
    jsonb_build_object('access_status', 'active',
                       'supabase_user_id', p_auth_user_id),
    p_request_id
  );
  return v_before.id;
end
$$;
revoke all on function public.confirm_staff_invite(uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_staff_invite(uuid, text, text) to service_role;

-- Claiming an open task must not permit arbitrary column mutation. Remove the broad
-- direct-UPDATE claim policy and replace it with a narrow, atomic RPC that only sets
-- status and inserts the assignee for the calling active staff member.
drop policy if exists "Staff claim open tasks" on public.tasks;
drop policy if exists "Staff claim task assignees" on public.task_assignees;

create or replace function public.claim_task(p_task_id uuid)
returns void
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_staff uuid := public.current_staff_id();
  v_task public.tasks;
begin
  if v_staff is null then
    raise exception 'active staff required' using errcode = '42501';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if v_task.assignment_type <> 'open' or v_task.status <> 'open' then
    raise exception 'task is not open to claim' using errcode = '22023';
  end if;
  if exists (select 1 from public.task_assignees where task_id = p_task_id) then
    raise exception 'task already claimed' using errcode = '22023';
  end if;

  insert into public.task_assignees(task_id, staff_id, claimed_at)
  values (p_task_id, v_staff, now());

  update public.tasks set status = 'claimed' where id = p_task_id;
end
$$;
revoke all on function public.claim_task(uuid) from public, anon;
grant execute on function public.claim_task(uuid) to authenticated;
