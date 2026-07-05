-- Phase 1 parity: structured booking policy + client intake essentials.

create table if not exists public.booking_policy_settings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  cancellation_window_hours integer not null default 48 check (cancellation_window_hours between 1 and 168),
  late_cancel_fee_percent integer not null default 50 check (late_cancel_fee_percent between 0 and 100),
  no_show_fee_percent integer not null default 100 check (no_show_fee_percent between 0 and 100),
  late_grace_minutes integer not null default 15 check (late_grace_minutes between 0 and 120),
  same_week_reschedule_waives_fee boolean not null default true,
  requires_card_on_file boolean not null default true,
  deposit_type text not null default 'card_on_file' check (deposit_type in ('none', 'card_on_file', 'fixed', 'percent')),
  deposit_value integer check (deposit_value is null or deposit_value >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger booking_policy_settings_updated_at
  before update on public.booking_policy_settings
  for each row execute function public.set_updated_at();

alter table public.booking_policy_settings enable row level security;

create policy "Public read active booking policy settings"
  on public.booking_policy_settings for select
  using (is_active = true);

create policy "Managers manage booking policy settings"
  on public.booking_policy_settings for all
  using (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_salon_manager()
  );

insert into public.booking_policy_settings (
  slug,
  title,
  cancellation_window_hours,
  late_cancel_fee_percent,
  no_show_fee_percent,
  late_grace_minutes,
  same_week_reschedule_waives_fee,
  requires_card_on_file,
  deposit_type,
  deposit_value,
  is_active
)
values (
  'default-phase1',
  'Salon Citrine Booking Policy',
  48,
  50,
  100,
  15,
  true,
  true,
  'card_on_file',
  null,
  true
)
on conflict (slug) do nothing;

alter table public.clients
  add column if not exists intake_notes text,
  add column if not exists booking_preferences text;

alter table public.appointments
  add column if not exists policy_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists deposit_required_cents integer not null default 0 check (deposit_required_cents >= 0);
