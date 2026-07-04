-- Back-bar inventory (Phase 3 MVP) — shared salon stock, transaction audit log

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  barcode text unique,
  brand text,
  category text,
  unit text not null default 'each',
  reorder_threshold numeric not null default 0 check (reorder_threshold >= 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_name_idx on public.products (name);
create index products_barcode_idx on public.products (barcode) where barcode is not null;
create index products_category_idx on public.products (category);
create index products_active_idx on public.products (is_active) where is_active = true;

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory_stock (single location for MVP)
-- ---------------------------------------------------------------------------
create table public.inventory_stock (
  product_id uuid primary key references public.products (id) on delete cascade,
  quantity numeric not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inventory_transactions (audit log)
-- ---------------------------------------------------------------------------
create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  staff_id uuid not null references public.staff (id) on delete restrict,
  type text not null check (type in ('receive', 'use', 'adjust', 'count')),
  quantity_change numeric not null,
  quantity_after numeric not null check (quantity_after >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index inventory_transactions_product_idx
  on public.inventory_transactions (product_id, created_at desc);

create index inventory_transactions_staff_idx
  on public.inventory_transactions (staff_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Apply transaction → update stock (security definer bypasses RLS on stock)
-- ---------------------------------------------------------------------------
create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_qty numeric;
  new_qty numeric;
begin
  select quantity into current_qty
  from public.inventory_stock
  where product_id = new.product_id
  for update;

  if not found then
    insert into public.inventory_stock (product_id, quantity)
    values (new.product_id, 0);
    current_qty := 0;
  end if;

  new_qty := current_qty + new.quantity_change;

  if new_qty < 0 then
    raise exception 'Insufficient stock for product %', new.product_id
      using errcode = 'check_violation';
  end if;

  update public.inventory_stock
  set quantity = new_qty,
      updated_at = now()
  where product_id = new.product_id;

  new.quantity_after := new_qty;
  return new;
end;
$$;

create trigger inventory_transactions_apply
  before insert on public.inventory_transactions
  for each row execute function public.apply_inventory_transaction();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.inventory_stock enable row level security;
alter table public.inventory_transactions enable row level security;

create policy "Team read products"
  on public.products for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
  );

create policy "Managers manage products"
  on public.products for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Managers update products"
  on public.products for update
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Team read inventory stock"
  on public.inventory_stock for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
  );

create policy "Team read inventory transactions"
  on public.inventory_transactions for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
  );

create policy "Team insert inventory transactions"
  on public.inventory_transactions for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and staff_id = public.current_staff_id()
  );

-- ---------------------------------------------------------------------------
-- Seed: sample back-bar products (fixed ids for stock rows)
-- ---------------------------------------------------------------------------
insert into public.products (
  id, name, sku, barcode, brand, category, unit, reorder_threshold, notes
) values
  (
    'a1000001-0000-4000-8000-000000000001',
    'Wella Color Touch 7/1 Ash Blonde',
    'WCT-71',
    '8500001234561',
    'Wella',
    'color',
    'tube',
    3,
    'Demi-permanent color'
  ),
  (
    'a1000001-0000-4000-8000-000000000002',
    'Redken Shades EQ 09N Cafe Au Lait',
    'RSEQ-09N',
    '8500001234638',
    'Redken',
    'color',
    'tube',
    4,
    null
  ),
  (
    'a1000001-0000-4000-8000-000000000003',
    'L''Oreal Majirel 6.0 Dark Blonde',
    'MAJ-60',
    '8500001234701',
    'L''Oreal',
    'color',
    'tube',
    3,
    null
  ),
  (
    'a1000001-0000-4000-8000-000000000004',
    'Matrix SoColor 5N Light Brown',
    'MSC-5N',
    '8500001234878',
    'Matrix',
    'color',
    'tube',
    3,
    null
  ),
  (
    'a1000001-0000-4000-8000-000000000005',
    'Joico Vero K-Pak Developer 20 Vol',
    'JKP-DEV20',
    '8500001234945',
    'Joico',
    'developer',
    'bottle',
    2,
    '1 liter'
  ),
  (
    'a1000001-0000-4000-8000-000000000006',
    'Redken All Soft Shampoo 33.8 oz',
    'RA-SH338',
    '8500001235012',
    'Redken',
    'shampoo',
    'bottle',
    2,
    'Back-bar size'
  ),
  (
    'a1000001-0000-4000-8000-000000000007',
    'Olaplex No.2 Bond Filler',
    'OLP-NO2',
    '8500001235189',
    'Olaplex',
    'treatment',
    'bottle',
    2,
    null
  ),
  (
    'a1000001-0000-4000-8000-000000000008',
    'Moroccanoil Treatment Original',
    'MO-TREAT',
    '8500001235256',
    'Moroccanoil',
    'styling',
    'bottle',
    1,
    null
  ),
  (
    'a1000001-0000-4000-8000-000000000009',
    'Barbicide Disinfectant 32 oz',
    'BARB-32',
    '8500001235323',
    'Barbicide',
    'sanitizer',
    'bottle',
    1,
    null
  ),
  (
    'a1000001-0000-4000-8000-000000000010',
    'Processing Caps 100 Pack',
    'CAP-100',
    '8500001235490',
    'Salon Basics',
    'tools',
    'box',
    1,
    null
  );

insert into public.inventory_stock (product_id, quantity) values
  ('a1000001-0000-4000-8000-000000000001', 8),
  ('a1000001-0000-4000-8000-000000000002', 2),
  ('a1000001-0000-4000-8000-000000000003', 5),
  ('a1000001-0000-4000-8000-000000000004', 1),
  ('a1000001-0000-4000-8000-000000000005', 3),
  ('a1000001-0000-4000-8000-000000000006', 4),
  ('a1000001-0000-4000-8000-000000000007', 2),
  ('a1000001-0000-4000-8000-000000000008', 1),
  ('a1000001-0000-4000-8000-000000000009', 2),
  ('a1000001-0000-4000-8000-000000000010', 6);
