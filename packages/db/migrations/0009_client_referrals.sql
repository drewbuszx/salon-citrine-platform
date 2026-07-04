-- Client referrals — track who referred whom and pending referral discounts

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id uuid not null references public.clients (id) on delete cascade,
  referred_client_id uuid not null references public.clients (id) on delete cascade,
  discount_applied boolean not null default false,
  created_at timestamptz not null default now(),
  constraint referrals_distinct_clients check (referrer_client_id <> referred_client_id),
  constraint referrals_unique_pair unique (referrer_client_id, referred_client_id)
);

create index referrals_referrer_idx on public.referrals (referrer_client_id);
create index referrals_referred_idx on public.referrals (referred_client_id);

-- Faster client name search for team autocomplete
create index clients_name_search_idx
  on public.clients using gin (
    to_tsvector('simple', coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
  );

alter table public.referrals enable row level security;

create policy "Team read referrals"
  on public.referrals for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
  );

create policy "Managers manage referrals"
  on public.referrals for all
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );
