-- Staff self-service profile updates (team account page)

alter table public.staff
  add column if not exists phone text;

create policy "Staff update own profile"
  on public.staff for update
  using (
    auth.role() = 'authenticated'
    and supabase_user_id = auth.uid()
  )
  with check (
    auth.role() = 'authenticated'
    and supabase_user_id = auth.uid()
  );
