-- New-client intake form fields (booking flow + team client profile).

alter table public.clients
  add column if not exists birthday date,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists address_city text,
  add column if not exists address_state text,
  add column if not exists address_zip text,
  add column if not exists preferred_contact_method text
    check (
      preferred_contact_method is null
      or preferred_contact_method in ('text', 'email', 'call')
    ),
  add column if not exists referral_sources text[] not null default '{}'::text[];
