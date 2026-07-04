-- Staff profile photos in Supabase Storage + crop metadata for avatar framing

alter table public.staff
  add column if not exists photo_crop jsonb;

comment on column public.staff.photo_crop is
  'Avatar framing: { "x": 0-100, "y": 0-100, "scale": 1-3 } for object-position and zoom';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-photos',
  'staff-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public read staff photos"
  on storage.objects for select
  using (bucket_id = 'staff-photos');

create policy "Staff upload own photo"
  on storage.objects for insert
  with check (
    bucket_id = 'staff-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_staff_id()::text
  );

create policy "Staff update own photo"
  on storage.objects for update
  using (
    bucket_id = 'staff-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_staff_id()::text
  )
  with check (
    bucket_id = 'staff-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_staff_id()::text
  );

create policy "Staff delete own photo"
  on storage.objects for delete
  using (
    bucket_id = 'staff-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_staff_id()::text
  );
