-- Atomic employee invitation/access transitions for the Wave 1 Auth flow.
-- The service-role caller coordinates Supabase Auth while this function combines
-- staff state and durable audit in one database transaction.
-- transaction. The actor is independently checked as an active manager.
create or replace function public.admin_transition_staff_access(
  p_actor_staff_id uuid,
  p_target_staff_id uuid,
  p_action text,
  p_auth_user_id uuid,
  p_access_status text,
  p_request_id text default null
) returns public.staff
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_before public.staff;
  v_after public.staff;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_action not in ('invited','reinvited','linked','deactivated','reactivated') then
    raise exception 'invalid access action' using errcode = '22023';
  end if;
  if p_access_status not in ('uninvited','invited','active','disabled') then
    raise exception 'invalid access status' using errcode = '22023';
  end if;

  select * into v_before from public.staff where id = p_target_staff_id for update;
  if not found then raise exception 'staff not found' using errcode = 'P0002'; end if;

  -- Transition-consistency checks run first, so an invalid action/state/identity
  -- combination fails as 22023 before any authorization decision.
  if p_action in ('invited','reinvited') and (
    p_access_status <> 'invited'
    or p_auth_user_id is null
    or (p_action = 'reinvited' and (
      v_before.access_status <> 'invited'
      or v_before.supabase_user_id is distinct from p_auth_user_id
    ))
  ) then
    raise exception 'invalid invitation transition' using errcode = '22023';
  end if;
  if p_action = 'linked' and (
    p_access_status <> 'active'
    or p_auth_user_id is null
    or v_before.access_status <> 'invited'
    or v_before.supabase_user_id is distinct from p_auth_user_id
  ) then
    raise exception 'invalid invitation activation' using errcode = '22023';
  end if;
  if p_action = 'deactivated' and p_access_status <> 'disabled' then
    raise exception 'invalid deactivation transition' using errcode = '22023';
  end if;
  if p_action = 'reactivated' and p_access_status not in ('active','uninvited') then
    raise exception 'invalid reactivation transition' using errcode = '22023';
  end if;

  if p_action = 'linked' then
    if not exists (
      select 1 from public.staff_security_audit a
      where a.actor_staff_id = p_actor_staff_id
        and a.target_staff_id = p_target_staff_id
        and a.action in ('invited','reinvited')
        and a.after_state ->> 'supabase_user_id' = p_auth_user_id::text
    ) then
      raise exception 'matching invitation audit required' using errcode = '42501';
    end if;
  elsif not exists (
      select 1 from public.staff s
      where s.id = p_actor_staff_id
        and s.access_status = 'active'
        and s.role in ('owner','front_desk')
    ) then
      raise exception 'active manager actor required' using errcode = '42501';
  end if;

  update public.staff
  set supabase_user_id = p_auth_user_id,
      access_status = p_access_status,
      auth_invited_at = case
        when p_action in ('invited','reinvited') then now()
        else auth_invited_at
      end,
      deactivated_at = case when p_access_status = 'disabled' then now() else null end
  where id = p_target_staff_id
  returning * into v_after;

  insert into public.staff_security_audit(
    actor_staff_id,target_staff_id,action,before_state,after_state,request_id
  ) values (
    p_actor_staff_id,p_target_staff_id,p_action,
    jsonb_build_object(
      'supabase_user_id',v_before.supabase_user_id,
      'access_status',v_before.access_status
    ),
    jsonb_build_object(
      'supabase_user_id',v_after.supabase_user_id,
      'access_status',v_after.access_status
    ),
    p_request_id
  );
  return v_after;
end
$$;
revoke all on function public.admin_transition_staff_access(uuid,uuid,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.admin_transition_staff_access(uuid,uuid,text,uuid,text,text) to service_role;
