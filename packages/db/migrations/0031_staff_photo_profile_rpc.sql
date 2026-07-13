-- Preserve scoped self-service photo/crop editing after whole-row UPDATE revocation.
-- Returns void so a direct RPC caller never receives sensitive staff columns
-- (auth linkage, booking tokens, etc.). Validation rejects malformed crop shapes.
create or replace function public.update_own_staff_photo(
  p_photo_url text,
  p_photo_crop jsonb
) returns void
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_rows int;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_photo_url is not null and p_photo_url !~ '^https://' then
    raise exception 'invalid photo URL' using errcode = '22023';
  end if;

  if p_photo_crop is not null then
    -- Require an object containing exactly x, y, and scale.
    if jsonb_typeof(p_photo_crop) <> 'object'
       or not (p_photo_crop ?& array['x','y','scale'])
       or (select count(*) from jsonb_object_keys(p_photo_crop)) <> 3
    then
      raise exception 'invalid photo crop shape' using errcode = '22023';
    end if;
    -- Require numeric JSON types before any numeric cast so malformed input
    -- surfaces as 22023 rather than a cast error (22P02).
    if jsonb_typeof(p_photo_crop->'x') <> 'number'
       or jsonb_typeof(p_photo_crop->'y') <> 'number'
       or jsonb_typeof(p_photo_crop->'scale') <> 'number'
    then
      raise exception 'photo crop values must be numbers' using errcode = '22023';
    end if;
    if (p_photo_crop->>'x')::numeric not between 0 and 100
       or (p_photo_crop->>'y')::numeric not between 0 and 100
       or (p_photo_crop->>'scale')::numeric not between 1 and 3
    then
      raise exception 'photo crop out of range' using errcode = '22023';
    end if;
  end if;

  update public.staff
  set photo_url = coalesce(p_photo_url, photo_url),
      photo_crop = p_photo_crop
  where supabase_user_id = auth.uid()
    and access_status = 'active';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'active staff profile not found' using errcode = '42501';
  end if;
end
$$;
revoke all on function public.update_own_staff_photo(text, jsonb) from public;
grant execute on function public.update_own_staff_photo(text, jsonb) to authenticated;
