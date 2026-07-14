-- Staff bio approval workflow.
-- staff.bio = last approved text (what managers copy to saloncitrineindy.com).
-- staff.bio_pending + bio_status track submissions awaiting review.
-- Do NOT auto-push to the marketing site CMS.

alter table public.staff
  add column if not exists bio_pending text,
  add column if not exists bio_status text not null default 'none',
  add column if not exists bio_submitted_at timestamptz,
  add column if not exists bio_reviewed_at timestamptz,
  add column if not exists bio_reviewed_by uuid references public.staff (id) on delete set null,
  add column if not exists bio_review_note text;

alter table public.staff
  drop constraint if exists staff_bio_status_check;
alter table public.staff
  add constraint staff_bio_status_check
    check (bio_status in ('none', 'pending', 'approved', 'declined'));

comment on column public.staff.bio is
  'Last approved bio for the public marketing site. Managers copy this manually to saloncitrineindy.com.';
comment on column public.staff.bio_pending is
  'Submitted bio awaiting manager approval; not live on the marketing site.';
comment on column public.staff.bio_status is
  'Bio workflow: none | pending | approved | declined.';

-- Existing published bios count as approved.
update public.staff
set bio_status = 'approved',
    bio_reviewed_at = coalesce(bio_reviewed_at, now())
where nullif(btrim(bio), '') is not null
  and bio_status = 'none';

-- Self-service profile RPC no longer publishes bio immediately.
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

  -- p_bio is ignored for publish; use submit_own_staff_bio. Kept for call-site compat.
  update public.staff
  set name = btrim(p_name),
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

create or replace function public.submit_own_staff_bio(
  p_bio text
) returns public.staff
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_staff public.staff;
  v_bio text := nullif(btrim(p_bio), '');
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if v_bio is null then raise exception 'bio is required' using errcode = '22023'; end if;
  if char_length(v_bio) > 2000 then raise exception 'bio too long' using errcode = '22023'; end if;

  update public.staff
  set bio_pending = v_bio,
      bio_status = 'pending',
      bio_submitted_at = now(),
      bio_review_note = null,
      bio_reviewed_at = null,
      bio_reviewed_by = null
  where supabase_user_id = auth.uid()
    and access_status = 'active'
  returning * into v_staff;

  if not found then raise exception 'active staff profile not found' using errcode = '42501'; end if;
  return v_staff;
end
$$;
revoke all on function public.submit_own_staff_bio(text) from public;
grant execute on function public.submit_own_staff_bio(text) to authenticated;

create or replace function public.review_staff_bio(
  p_staff_id uuid,
  p_action text,
  p_note text default null
) returns public.staff
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_staff public.staff;
  v_actor uuid := public.current_staff_id();
  v_action text := lower(btrim(p_action));
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.is_salon_manager() then raise exception 'manager required' using errcode = '42501'; end if;
  if v_actor is null then raise exception 'active staff required' using errcode = '42501'; end if;
  if v_action not in ('approve', 'decline') then
    raise exception 'invalid bio review action' using errcode = '22023';
  end if;

  select * into v_staff from public.staff where id = p_staff_id for update;
  if not found then raise exception 'staff not found' using errcode = 'P0002'; end if;
  if v_staff.bio_status <> 'pending' or nullif(btrim(v_staff.bio_pending), '') is null then
    raise exception 'no pending bio to review' using errcode = '22023';
  end if;

  if v_action = 'approve' then
    update public.staff
    set bio = bio_pending,
        bio_pending = null,
        bio_status = 'approved',
        bio_reviewed_at = now(),
        bio_reviewed_by = v_actor,
        bio_review_note = v_note
    where id = p_staff_id
    returning * into v_staff;
  else
    update public.staff
    set bio_status = 'declined',
        bio_reviewed_at = now(),
        bio_reviewed_by = v_actor,
        bio_review_note = v_note
    where id = p_staff_id
    returning * into v_staff;
  end if;

  return v_staff;
end
$$;
revoke all on function public.review_staff_bio(uuid, text, text) from public;
grant execute on function public.review_staff_bio(uuid, text, text) to authenticated;

-- Manager direct bio edits publish immediately and clear any pending submission.
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
  v_actor uuid := public.current_staff_id();
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
      start_date = case when p_updates ? 'start_date' then nullif(btrim(p_updates->>'start_date'),'')::date else start_date end,
      bio_pending = case when p_updates ? 'bio' then null else bio_pending end,
      bio_status = case
        when p_updates ? 'bio' and nullif(btrim(p_updates->>'bio'),'') is not null then 'approved'
        when p_updates ? 'bio' then 'none'
        else bio_status
      end,
      bio_reviewed_at = case when p_updates ? 'bio' then now() else bio_reviewed_at end,
      bio_reviewed_by = case when p_updates ? 'bio' then v_actor else bio_reviewed_by end,
      bio_review_note = case when p_updates ? 'bio' then null else bio_review_note end,
      bio_submitted_at = case when p_updates ? 'bio' then null else bio_submitted_at end
  where id = p_staff_id returning * into v_after;

  if v_before.role is distinct from v_after.role then
    insert into public.staff_security_audit(actor_staff_id,target_staff_id,action,before_state,after_state,request_id)
    values (v_actor,p_staff_id,'role_changed',
      jsonb_build_object('role',v_before.role),jsonb_build_object('role',v_after.role),p_request_id);
  end if;
  return v_after;
end
$$;
revoke all on function public.manager_update_staff(uuid, jsonb, text) from public;
grant execute on function public.manager_update_staff(uuid, jsonb, text) to authenticated;
