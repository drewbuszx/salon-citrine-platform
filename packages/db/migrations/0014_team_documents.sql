-- Team document storage MVP — employee handbook, policies, training files

-- ---------------------------------------------------------------------------
-- team_documents
-- ---------------------------------------------------------------------------
create table public.team_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text check (category in ('policies', 'training', 'forms', 'other')),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  uploaded_by_staff_id uuid not null references public.staff (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index team_documents_active_idx
  on public.team_documents (is_active, created_at desc)
  where is_active = true;

create index team_documents_category_idx
  on public.team_documents (category)
  where is_active = true;

create trigger team_documents_updated_at
  before update on public.team_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Supabase Storage — private team-documents bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-documents',
  'team-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Team read team documents storage"
  on storage.objects for select
  using (
    bucket_id = 'team-documents'
    and auth.role() = 'authenticated'
    and public.is_linked_staff()
  );

create policy "Managers upload team documents storage"
  on storage.objects for insert
  with check (
    bucket_id = 'team-documents'
    and auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Managers update team documents storage"
  on storage.objects for update
  using (
    bucket_id = 'team-documents'
    and auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    bucket_id = 'team-documents'
    and auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Managers delete team documents storage"
  on storage.objects for delete
  using (
    bucket_id = 'team-documents'
    and auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.team_documents enable row level security;

create policy "Team read active documents"
  on public.team_documents for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and is_active = true
  );

create policy "Managers read all documents"
  on public.team_documents for select
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Managers create documents"
  on public.team_documents for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
    and uploaded_by_staff_id = public.current_staff_id()
  );

create policy "Managers update documents"
  on public.team_documents for update
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Managers delete documents"
  on public.team_documents for delete
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

-- ---------------------------------------------------------------------------
-- Seed sample documents (metadata only — upload real files via team app)
-- ---------------------------------------------------------------------------
insert into public.team_documents (
  id,
  title,
  description,
  category,
  storage_path,
  file_name,
  mime_type,
  file_size_bytes,
  uploaded_by_staff_id
) values
  (
    'd1000001-0001-4000-8000-000000000001',
    'Employee Handbook',
    'Salon policies, expectations, and onboarding reference for all team members.',
    'policies',
    'seed/employee-handbook.pdf',
    'employee-handbook.pdf',
    'application/pdf',
    null,
    'a1000001-0001-4000-8000-000000000001'
  ),
  (
    'd1000001-0001-4000-8000-000000000002',
    'Color Theory Training Guide',
    'Internal training PDF for new stylists — fundamentals and salon standards.',
    'training',
    'seed/color-theory-training.pdf',
    'color-theory-training.pdf',
    'application/pdf',
    null,
    'a1000001-0001-4000-8000-000000000001'
  );
