-- Product images in Supabase Storage (public bucket, manager uploads)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Managers upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Managers update product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Managers delete product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
    and public.is_salon_manager()
  );
