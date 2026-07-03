-- Salon Citrine — core schema (Phase 1)
-- Apply with Supabase CLI: supabase db push / psql

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  role text not null check (role in ('owner', 'stylist', 'esthetician', 'front_desk')),
  bio text,
  photo_url text,
  glossgenius_token text,
  is_bookable boolean not null default true,
  supabase_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_slug_idx on public.staff (slug);
create index staff_bookable_idx on public.staff (is_bookable) where is_bookable = true;

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  description text,
  base_price_cents integer,
  duration_minutes integer not null default 60,
  price_varies boolean not null default false,
  is_addon boolean not null default false,
  requires_consultation boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_category_idx on public.services (category);
create index services_active_idx on public.services (is_active) where is_active = true;

-- ---------------------------------------------------------------------------
-- staff_services (many-to-many)
-- ---------------------------------------------------------------------------
create table public.staff_services (
  staff_id uuid not null references public.staff (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  price_override_cents integer,
  primary key (staff_id, service_id)
);

-- ---------------------------------------------------------------------------
-- staff_schedules (weekly hours per provider)
-- ---------------------------------------------------------------------------
create table public.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  effective_from date not null default current_date,
  effective_until date,
  constraint staff_schedules_time_order check (start_time < end_time)
);

create index staff_schedules_staff_day_idx
  on public.staff_schedules (staff_id, day_of_week);

-- ---------------------------------------------------------------------------
-- blocked_times
-- ---------------------------------------------------------------------------
create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint blocked_times_range check (starts_at < ends_at)
);

create index blocked_times_staff_range_idx
  on public.blocked_times (staff_id, starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  stripe_customer_id text,
  sms_opt_in boolean not null default false,
  email_opt_in boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_email_idx on public.clients (email);
create index clients_phone_idx on public.clients (phone);

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  staff_id uuid not null references public.staff (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  stripe_payment_intent_id text,
  policy_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_range check (starts_at < ends_at)
);

create index appointments_staff_starts_idx
  on public.appointments (staff_id, starts_at);
create index appointments_client_idx on public.appointments (client_id);

-- ---------------------------------------------------------------------------
-- appointment_services (multi-service bookings)
-- ---------------------------------------------------------------------------
create table public.appointment_services (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  price_cents integer,
  primary key (appointment_id, service_id)
);

-- ---------------------------------------------------------------------------
-- email_logs
-- ---------------------------------------------------------------------------
create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  template text not null,
  resend_id text,
  status text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sms_logs
-- ---------------------------------------------------------------------------
create table public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  body text not null,
  twilio_sid text,
  status text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- policies
-- ---------------------------------------------------------------------------
create table public.policies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger staff_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

create trigger services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.staff enable row level security;
alter table public.services enable row level security;
alter table public.staff_services enable row level security;
alter table public.staff_schedules enable row level security;
alter table public.blocked_times enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;
alter table public.email_logs enable row level security;
alter table public.sms_logs enable row level security;
alter table public.policies enable row level security;

-- Public read: bookable staff, active services, active policies
create policy "Public read bookable staff"
  on public.staff for select
  using (is_bookable = true);

create policy "Public read active services"
  on public.services for select
  using (is_active = true and is_addon = false);

create policy "Public read active policies"
  on public.policies for select
  using (is_active = true);

create policy "Public read staff schedules"
  on public.staff_schedules for select
  using (true);

-- Authenticated staff: full access to operational tables
create policy "Staff manage appointments"
  on public.appointments for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Staff manage appointment services"
  on public.appointment_services for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Staff manage clients"
  on public.clients for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Staff manage blocked times"
  on public.blocked_times for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Staff read all staff"
  on public.staff for select
  using (auth.role() = 'authenticated');

create policy "Staff read all services"
  on public.services for select
  using (auth.role() = 'authenticated');

create policy "Staff read staff services"
  on public.staff_services for select
  using (auth.role() = 'authenticated');

create policy "Staff read logs"
  on public.email_logs for select
  using (auth.role() = 'authenticated');

create policy "Staff read sms logs"
  on public.sms_logs for select
  using (auth.role() = 'authenticated');

-- Service role bypasses RLS (Supabase default for service_role key)
