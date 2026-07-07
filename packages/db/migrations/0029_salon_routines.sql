-- Salon opening/closing run-through checklists (shared operational routines, not task assignments)

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
create table public.salon_routines (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('opening', 'closing')),
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.salon_routine_items (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.salon_routines (id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index salon_routine_items_routine_idx
  on public.salon_routine_items (routine_id, sort_order);

-- Daily completion keyed by salon calendar date (America/Indiana/Indianapolis)
create table public.salon_routine_completions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.salon_routine_items (id) on delete cascade,
  salon_date date not null,
  completed_by_staff_id uuid references public.staff (id) on delete set null,
  completed_at timestamptz not null default now(),
  unique (item_id, salon_date)
);

create index salon_routine_completions_date_idx
  on public.salon_routine_completions (salon_date);

-- ---------------------------------------------------------------------------
-- RLS — any linked team member can read templates and toggle today's items
-- ---------------------------------------------------------------------------
alter table public.salon_routines enable row level security;
alter table public.salon_routine_items enable row level security;
alter table public.salon_routine_completions enable row level security;

create policy "Team read salon routines"
  on public.salon_routines for select
  using (auth.role() = 'authenticated' and public.is_linked_staff());

create policy "Team read salon routine items"
  on public.salon_routine_items for select
  using (auth.role() = 'authenticated' and public.is_linked_staff());

create policy "Team read salon routine completions"
  on public.salon_routine_completions for select
  using (auth.role() = 'authenticated' and public.is_linked_staff());

create policy "Team complete salon routine items"
  on public.salon_routine_completions for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and completed_by_staff_id = public.current_staff_id()
  );

create policy "Team uncomplete salon routine items"
  on public.salon_routine_completions for delete
  using (auth.role() = 'authenticated' and public.is_linked_staff());

-- ---------------------------------------------------------------------------
-- Seed opening and closing templates
-- ---------------------------------------------------------------------------
insert into public.salon_routines (id, slug, title, sort_order) values
  ('d2000001-0001-4000-8000-000000000001', 'opening', 'Opening the salon', 1),
  ('d2000001-0001-4000-8000-000000000002', 'closing', 'Closing the salon', 2);

insert into public.salon_routine_items (routine_id, label, sort_order) values
  ('d2000001-0001-4000-8000-000000000001', 'Unlock front and back doors', 1),
  ('d2000001-0001-4000-8000-000000000001', 'Turn on salon lights', 2),
  ('d2000001-0001-4000-8000-000000000001', 'Start background music at a comfortable volume', 3),
  ('d2000001-0001-4000-8000-000000000001', 'Boot reception iPad and card reader', 4),
  ('d2000001-0001-4000-8000-000000000001', 'Review today''s appointment book', 5),
  ('d2000001-0001-4000-8000-000000000001', 'Count and verify starting cash drawer', 6),
  ('d2000001-0001-4000-8000-000000000001', 'Restock clean towels at each station', 7),
  ('d2000001-0001-4000-8000-000000000001', 'Check shampoo and conditioner levels at bowls', 8),
  ('d2000001-0001-4000-8000-000000000001', 'Brew coffee and set out refreshments', 9),
  ('d2000001-0001-4000-8000-000000000001', 'Walk the floor — stations clean and ready', 10),
  ('d2000001-0001-4000-8000-000000000001', 'Confirm back-bar inventory for color services', 11),
  ('d2000001-0001-4000-8000-000000000001', 'Post an opening note in team chat if anything is off', 12);

insert into public.salon_routine_items (routine_id, label, sort_order) values
  ('d2000001-0001-4000-8000-000000000002', 'Confirm all clients are checked out', 1),
  ('d2000001-0001-4000-8000-000000000002', 'Run end-of-day sales report', 2),
  ('d2000001-0001-4000-8000-000000000002', 'Count cash drawer and reconcile', 3),
  ('d2000001-0001-4000-8000-000000000002', 'Clean and sanitize all stations', 4),
  ('d2000001-0001-4000-8000-000000000002', 'Wash color bowls and brushes', 5),
  ('d2000001-0001-4000-8000-000000000002', 'Empty trash and replace liners', 6),
  ('d2000001-0001-4000-8000-000000000002', 'Start laundry if needed', 7),
  ('d2000001-0001-4000-8000-000000000002', 'Wipe reception desk, iPad, and card reader', 8),
  ('d2000001-0001-4000-8000-000000000002', 'Restock retail display if low', 9),
  ('d2000001-0001-4000-8000-000000000002', 'Turn off music and salon lights', 10),
  ('d2000001-0001-4000-8000-000000000002', 'Lock all doors and set alarm', 11),
  ('d2000001-0001-4000-8000-000000000002', 'Leave a brief closing note for tomorrow''s opener', 12);
