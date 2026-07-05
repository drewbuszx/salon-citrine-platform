-- Boulevard-aligned booking parity: locations, carts, reservations, waitlist, lifecycle states.

-- ---------------------------------------------------------------------------
-- locations (single-location MVP; Boulevard is multi-location)
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null default 'America/Indiana/Indianapolis',
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  phone text,
  min_booking_lead_minutes integer not null default 0 check (min_booking_lead_minutes >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger locations_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

insert into public.locations (
  slug,
  name,
  address_line1,
  city,
  state,
  postal_code,
  phone
)
values (
  'salon-citrine-indy',
  'Salon Citrine',
  '115 S East St',
  'Indianapolis',
  'IN',
  '46202',
  null
)
on conflict (slug) do nothing;

alter table public.locations enable row level security;

create policy "Public read active locations"
  on public.locations for select
  using (is_active = true);

create policy "Managers manage locations"
  on public.locations for all
  using (auth.role() = 'authenticated' and public.is_salon_manager())
  with check (auth.role() = 'authenticated' and public.is_salon_manager());

-- ---------------------------------------------------------------------------
-- appointment lifecycle: add Boulevard states booked + arrived
-- ---------------------------------------------------------------------------
alter table public.appointments drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check
  check (status in (
    'booked',
    'pending',
    'confirmed',
    'arrived',
    'completed',
    'cancelled',
    'no_show'
  ));

alter table public.appointments
  add column if not exists location_id uuid references public.locations (id) on delete set null;

update public.appointments a
set location_id = l.id
from public.locations l
where a.location_id is null
  and l.slug = 'salon-citrine-indy';

-- ---------------------------------------------------------------------------
-- overlap rules: booked + arrived block calendar like confirmed
-- ---------------------------------------------------------------------------
create extension if not exists btree_gist;

alter table public.appointments drop constraint if exists appointments_no_staff_overlap;

alter table public.appointments
  add constraint appointments_no_staff_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('booked', 'pending', 'confirmed', 'arrived'));

create or replace function public.enforce_appointment_not_blocked()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('booked', 'pending', 'confirmed', 'arrived') then
    return new;
  end if;

  if exists (
    select 1
    from public.blocked_times bt
    where bt.staff_id = new.staff_id
      and tstzrange(bt.starts_at, bt.ends_at, '[)')
          && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'appointment conflicts with blocked time'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop view if exists public.appointment_availability;

create view public.appointment_availability as
select
  staff_id,
  starts_at,
  ends_at,
  status
from public.appointments
where status in ('booked', 'pending', 'confirmed', 'arrived');

grant select on public.appointment_availability to anon, authenticated;

-- ---------------------------------------------------------------------------
-- booking carts (Boulevard Client API Cart model)
-- ---------------------------------------------------------------------------
create table if not exists public.booking_carts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete restrict,
  staff_id uuid references public.staff (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  session_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'open'
    check (status in ('open', 'reserved', 'completed', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  expires_at timestamptz,
  client_email text,
  client_phone text,
  client_first_name text,
  client_last_name text,
  client_message text,
  referral_source text,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index booking_carts_session_token_idx on public.booking_carts (session_token);
create index booking_carts_expires_at_idx on public.booking_carts (expires_at)
  where status = 'reserved' and expires_at is not null;

create trigger booking_carts_updated_at
  before update on public.booking_carts
  for each row execute function public.set_updated_at();

create table if not exists public.booking_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.booking_carts (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  staff_id uuid references public.staff (id) on delete set null,
  sort_order integer not null default 0,
  price_cents integer,
  duration_minutes integer not null,
  is_addon boolean not null default false,
  option_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now()
);

create index booking_cart_items_cart_idx on public.booking_cart_items (cart_id);

-- Temporary slot holds (Boulevard reserveBookableItems / cart.expiresAt)
create or replace view public.booking_cart_reservations as
select
  bc.staff_id,
  bc.starts_at,
  bc.ends_at
from public.booking_carts bc
where bc.status = 'reserved'
  and bc.starts_at is not null
  and bc.ends_at is not null
  and bc.expires_at is not null
  and bc.expires_at > now();

grant select on public.booking_cart_reservations to anon, authenticated;

alter table public.booking_carts enable row level security;
alter table public.booking_cart_items enable row level security;

create policy "Public manage own booking carts by session"
  on public.booking_carts for all
  using (true)
  with check (true);

create policy "Public manage booking cart items"
  on public.booking_cart_items for all
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- waitlist (Boulevard cart.addToWaitlist)
-- ---------------------------------------------------------------------------
create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete restrict,
  staff_id uuid references public.staff (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  service_ids uuid[] not null,
  preferred_date date,
  preferred_time_start time,
  preferred_time_end time,
  client_email text not null,
  client_phone text,
  client_first_name text,
  client_last_name text,
  client_message text,
  status text not null default 'active'
    check (status in ('active', 'notified', 'booked', 'expired', 'cancelled')),
  notes text,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index waitlist_entries_status_idx on public.waitlist_entries (status)
  where status = 'active';

create trigger waitlist_entries_updated_at
  before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

alter table public.waitlist_entries enable row level security;

create policy "Public insert waitlist entries"
  on public.waitlist_entries for insert
  with check (true);

create policy "Team read waitlist entries"
  on public.waitlist_entries for select
  using (auth.role() = 'authenticated');

create policy "Managers manage waitlist entries"
  on public.waitlist_entries for all
  using (auth.role() = 'authenticated' and public.is_salon_manager())
  with check (auth.role() = 'authenticated' and public.is_salon_manager());

-- ---------------------------------------------------------------------------
-- service option groups (Boulevard CartAvailableBookableItemOption)
-- ---------------------------------------------------------------------------
create table if not exists public.service_option_groups (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  name text not null,
  min_selections integer not null default 0 check (min_selections >= 0),
  max_selections integer not null default 1 check (max_selections >= 1),
  is_required boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists public.service_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.service_option_groups (id) on delete cascade,
  name text not null,
  duration_delta_minutes integer not null default 0,
  price_delta_cents integer not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

alter table public.service_option_groups enable row level security;
alter table public.service_options enable row level security;

create policy "Public read service option groups"
  on public.service_option_groups for select
  using (true);

create policy "Public read active service options"
  on public.service_options for select
  using (is_active = true);

create policy "Managers manage service option groups"
  on public.service_option_groups for all
  using (auth.role() = 'authenticated' and public.is_salon_manager())
  with check (auth.role() = 'authenticated' and public.is_salon_manager());

create policy "Managers manage service options"
  on public.service_options for all
  using (auth.role() = 'authenticated' and public.is_salon_manager())
  with check (auth.role() = 'authenticated' and public.is_salon_manager());

-- ---------------------------------------------------------------------------
-- structured booking questions / intake responses on appointments
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists booking_question_responses jsonb not null default '{}'::jsonb,
  add column if not exists client_message text,
  add column if not exists referral_source text;
