-- Boulevard checkout + client CRM parity (team-side MVP).

-- ---------------------------------------------------------------------------
-- Client CRM fields (Boulevard Client profile)
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists staff_notes text,
  add column if not exists formula_notes text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists visit_count integer not null default 0 check (visit_count >= 0),
  add column if not exists last_visit_at timestamptz,
  add column if not exists lifetime_value_cents integer not null default 0 check (lifetime_value_cents >= 0);

-- ---------------------------------------------------------------------------
-- Retail pricing for checkout add-ons
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists retail_price_cents integer
    check (retail_price_cents is null or retail_price_cents >= 0);

-- ---------------------------------------------------------------------------
-- Client notes timeline (Boulevard client notes / formulas)
-- ---------------------------------------------------------------------------
create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete restrict,
  note_type text not null default 'general'
    check (note_type in ('general', 'formula', 'preference')),
  body text not null,
  created_at timestamptz not null default now()
);

create index client_notes_client_idx on public.client_notes (client_id, created_at desc);

alter table public.client_notes enable row level security;

create policy "Team read client notes"
  on public.client_notes for select
  using (auth.role() = 'authenticated' and public.is_linked_staff());

create policy "Team insert client notes"
  on public.client_notes for insert
  with check (auth.role() = 'authenticated' and public.is_linked_staff());

create policy "Managers delete client notes"
  on public.client_notes for delete
  using (auth.role() = 'authenticated' and public.is_salon_manager());

-- ---------------------------------------------------------------------------
-- Checkout orders (Boulevard Order / cart checkout)
-- ---------------------------------------------------------------------------
create table if not exists public.checkout_orders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete restrict,
  staff_id uuid not null references public.staff (id) on delete restrict,
  location_id uuid references public.locations (id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'completed', 'void')),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  tip_cents integer not null default 0 check (tip_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  deposit_applied_cents integer not null default 0 check (deposit_applied_cents >= 0),
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),
  stripe_payment_intent_id text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index checkout_orders_appointment_idx on public.checkout_orders (appointment_id);
create index checkout_orders_client_idx on public.checkout_orders (client_id, created_at desc);

create trigger checkout_orders_updated_at
  before update on public.checkout_orders
  for each row execute function public.set_updated_at();

create table if not exists public.checkout_line_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.checkout_orders (id) on delete cascade,
  kind text not null check (kind in ('service', 'product', 'tip', 'discount')),
  service_id uuid references public.services (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price_cents integer not null,
  total_cents integer not null,
  sort_order integer not null default 0
);

create index checkout_line_items_order_idx on public.checkout_line_items (order_id, sort_order);

alter table public.appointments
  add column if not exists checkout_order_id uuid references public.checkout_orders (id) on delete set null;

alter table public.checkout_orders enable row level security;
alter table public.checkout_line_items enable row level security;

create policy "Team read checkout orders"
  on public.checkout_orders for select
  using (auth.role() = 'authenticated' and public.is_linked_staff());

create policy "Team manage checkout orders"
  on public.checkout_orders for all
  using (auth.role() = 'authenticated' and public.is_linked_staff())
  with check (auth.role() = 'authenticated' and public.is_linked_staff());

create policy "Team read checkout line items"
  on public.checkout_line_items for select
  using (auth.role() = 'authenticated' and public.is_linked_staff());

create policy "Team manage checkout line items"
  on public.checkout_line_items for all
  using (auth.role() = 'authenticated' and public.is_linked_staff())
  with check (auth.role() = 'authenticated' and public.is_linked_staff());

-- ---------------------------------------------------------------------------
-- Refresh client visit stats after completed checkout
-- ---------------------------------------------------------------------------
create or replace function public.refresh_client_visit_stats(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit_count integer;
  v_last_visit timestamptz;
  v_lifetime integer;
begin
  select count(*)::integer,
         max(co.completed_at),
         coalesce(sum(co.total_cents), 0)::integer
  into v_visit_count, v_last_visit, v_lifetime
  from public.checkout_orders co
  where co.client_id = p_client_id
    and co.status = 'completed';

  update public.clients
  set visit_count = v_visit_count,
      last_visit_at = v_last_visit,
      lifetime_value_cents = v_lifetime,
      updated_at = now()
  where id = p_client_id;
end;
$$;
