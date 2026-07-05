-- Product images: external URL or Supabase Storage public URL

alter table public.products
  add column if not exists image_url text;

comment on column public.products.image_url is
  'Product photo URL (external or Supabase Storage public URL)';
