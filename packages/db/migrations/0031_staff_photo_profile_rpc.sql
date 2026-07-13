-- Preserve scoped self-service photo/crop editing after whole-row UPDATE revocation.
create or replace function public.update_own_staff_photo(
  p_photo_url text,
  p_photo_crop jsonb
) returns public.staff
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_staff public.staff;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_photo_url is not null and p_photo_url !~ '^https://' then
    raise exception 'invalid photo URL' using errcode = '22023';
  end if;
  if p_photo_crop is not null and (
    jsonb_typeof(p_photo_crop) <> 'object'
    or not (p_photo_crop ?& array['x','y','scale'])
    or (p_photo_crop->>'x')::numeric not between 0 and 1
    or (p_photo_crop->>'y')::numeric not between 0 and 1
    or (p_photo_crop->>'scale')::numeric not between 1 and 5
  ) then
    raise exception 'invalid photo crop' using errcode = '22023';
  end if;

  update public.staff
  set photo_url = coalesce(p_photo_url, photo_url),
      photo_crop = p_photo_crop
  where supabase_user_id = auth.uid()
    and access_status = 'active'
  returning * into v_staff;
  if not found then raise exception 'active staff profile not found' using errcode = '42501'; end if;
  return v_staff;
end
$$;
revoke all on function public.update_own_staff_photo(text, jsonb) from public;
grant execute on function public.update_own_staff_photo(text, jsonb) to authenticated;
