-- Shared team events calendar — salon announcements, closures, time off visibility

-- ---------------------------------------------------------------------------
-- team_events
-- ---------------------------------------------------------------------------
create table public.team_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null default 'event'
    check (event_type in ('event', 'time_off', 'closure', 'announcement')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  created_by_staff_id uuid not null references public.staff (id) on delete restrict,
  staff_id uuid references public.staff (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index team_events_range_idx
  on public.team_events (starts_at, ends_at)
  where is_active = true;

create index team_events_type_idx
  on public.team_events (event_type)
  where is_active = true;

create trigger team_events_updated_at
  before update on public.team_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.team_events enable row level security;

create policy "Team read active events"
  on public.team_events for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and is_active = true
  );

create policy "Managers read all events"
  on public.team_events for select
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

create policy "Team create events"
  on public.team_events for insert
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and created_by_staff_id = public.current_staff_id()
    and (
      public.is_salon_manager()
      or (
        event_type = 'time_off'
        and staff_id = public.current_staff_id()
      )
    )
  );

create policy "Team update events"
  on public.team_events for update
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or (
        event_type = 'time_off'
        and staff_id = public.current_staff_id()
        and created_by_staff_id = public.current_staff_id()
      )
    )
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or (
        event_type = 'time_off'
        and staff_id = public.current_staff_id()
        and created_by_staff_id = public.current_staff_id()
      )
    )
  );

create policy "Team delete events"
  on public.team_events for delete
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or (
        event_type = 'time_off'
        and staff_id = public.current_staff_id()
        and created_by_staff_id = public.current_staff_id()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Seed sample events (relative to current date)
-- ---------------------------------------------------------------------------
insert into public.team_events (
  id,
  title,
  description,
  event_type,
  starts_at,
  ends_at,
  all_day,
  created_by_staff_id,
  staff_id
) values
  (
    'e1000001-0001-4000-8000-000000000001',
    'Monthly team meeting',
    'All-hands at 9 AM before we open — updates, shout-outs, and scheduling notes.',
    'event',
    (current_date + interval '7 days') + time '09:00',
    (current_date + interval '7 days') + time '10:00',
    false,
    'a1000001-0001-4000-8000-000000000001',
    null
  ),
  (
    'e1000001-0001-4000-8000-000000000002',
    'Salon closed — holiday',
    'Salon closed for the holiday. Online booking is paused for this day.',
    'closure',
    current_date + interval '14 days',
    current_date + interval '14 days' + interval '23 hours 59 minutes',
    true,
    'a1000001-0001-4000-8000-000000000001',
    null
  ),
  (
    'e1000001-0001-4000-8000-000000000003',
    'Jules out of town',
    'Jules will be away — please refer color clients to Shelby or Brie.',
    'time_off',
    current_date + interval '3 days',
    current_date + interval '5 days' + interval '23 hours 59 minutes',
    true,
    'a1000001-0001-4000-8000-000000000005',
    'a1000001-0001-4000-8000-000000000005'
  ),
  (
    'e1000001-0001-4000-8000-000000000004',
    'New retail display arriving',
    'Moroccanoil display ships this week — help reset the front shelf when it arrives.',
    'announcement',
    current_date + interval '2 days',
    null,
    true,
    'a1000001-0001-4000-8000-000000000002',
    null
  );
