-- Team task list MVP — assign to staff or open claim pool

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'claimed', 'done', 'cancelled')),
  assignment_type text not null check (assignment_type in ('assigned', 'open')),
  created_by_staff_id uuid not null references public.staff (id) on delete restrict,
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  completed_at timestamptz,
  completed_by_staff_id uuid references public.staff (id) on delete set null,
  completion_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_status_active_idx
  on public.tasks (status)
  where status not in ('done', 'cancelled');

create index tasks_due_at_idx
  on public.tasks (due_at)
  where due_at is not null;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- task_assignees (multi-assignee; open-pool rows added on claim)
-- ---------------------------------------------------------------------------
create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  claimed_at timestamptz,
  primary key (task_id, staff_id)
);

create index task_assignees_staff_idx on public.task_assignees (staff_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;

create policy "Team read tasks"
  on public.tasks for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or (
        assignment_type = 'open'
        and status in ('open', 'claimed', 'done')
      )
      or exists (
        select 1
        from public.task_assignees ta
        where ta.task_id = tasks.id
          and ta.staff_id = public.current_staff_id()
      )
    )
  );

create policy "Managers create tasks"
  on public.tasks for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
    and created_by_staff_id = public.current_staff_id()
  );

create policy "Managers manage tasks"
  on public.tasks for update
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Staff complete assigned tasks"
  on public.tasks for update
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and status in ('open', 'claimed')
    and exists (
      select 1
      from public.task_assignees ta
      where ta.task_id = tasks.id
        and ta.staff_id = public.current_staff_id()
    )
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and status = 'done'
  );

create policy "Staff claim open tasks"
  on public.tasks for update
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and assignment_type = 'open'
    and status = 'open'
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and assignment_type = 'open'
    and status = 'claimed'
  );

create policy "Managers delete tasks"
  on public.tasks for delete
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Team read task assignees"
  on public.task_assignees for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or staff_id = public.current_staff_id()
      or exists (
        select 1
        from public.tasks t
        where t.id = task_assignees.task_id
          and t.assignment_type = 'open'
          and t.status in ('open', 'claimed', 'done')
      )
      or exists (
        select 1
        from public.task_assignees mine
        where mine.task_id = task_assignees.task_id
          and mine.staff_id = public.current_staff_id()
      )
    )
  );

create policy "Managers assign tasks"
  on public.task_assignees for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
    and exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.assignment_type = 'assigned'
    )
  );

create policy "Staff claim task assignees"
  on public.task_assignees for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and staff_id = public.current_staff_id()
    and exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.assignment_type = 'open'
        and t.status = 'open'
    )
  );

create policy "Managers manage task assignees"
  on public.task_assignees for delete
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Managers update task assignees"
  on public.task_assignees for update
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

-- ---------------------------------------------------------------------------
-- Seed sample tasks (dev / demo)
-- ---------------------------------------------------------------------------
insert into public.tasks (
  id,
  title,
  description,
  status,
  assignment_type,
  created_by_staff_id,
  due_at,
  priority
) values
  (
    'c1000001-0001-4000-8000-000000000001',
    'Restock towels in back room',
    'Check supply closet and refill clean towels at each station.',
    'open',
    'open',
    'a1000001-0001-4000-8000-000000000001',
    (current_date + interval '1 day') + time '17:00',
    'normal'
  ),
  (
    'c1000001-0001-4000-8000-000000000002',
    'Clean color bowls in station 3',
    'Wash and sanitize all color bowls and brushes after last client.',
    'open',
    'assigned',
    'a1000001-0001-4000-8000-000000000001',
    (current_date + interval '1 day') + time '20:00',
    'high'
  ),
  (
    'c1000001-0001-4000-8000-000000000003',
    'Wipe down reception desk',
    'Sanitize desk surface, iPad, and card reader before close.',
    'done',
    'open',
    'a1000001-0001-4000-8000-000000000001',
    current_date + time '17:00',
    'low'
  );

insert into public.task_assignees (task_id, staff_id) values
  ('c1000001-0001-4000-8000-000000000002', 'a1000001-0001-4000-8000-000000000004');

insert into public.task_assignees (task_id, staff_id, claimed_at) values
  (
    'c1000001-0001-4000-8000-000000000003',
    'a1000001-0001-4000-8000-000000000005',
    now() - interval '2 hours'
  );

update public.tasks
set
  completed_at = now() - interval '1 hour',
  completed_by_staff_id = 'a1000001-0001-4000-8000-000000000005',
  completion_notes = 'Desk and iPad wiped down.'
where id = 'c1000001-0001-4000-8000-000000000003';
