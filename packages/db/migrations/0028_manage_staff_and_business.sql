-- Manage pages: manager staff CRUD + business details on locations

-- ---------------------------------------------------------------------------
-- staff — managers may create and update employee profiles
-- ---------------------------------------------------------------------------
create policy "Managers insert staff"
  on public.staff for insert
  with check (auth.role() = 'authenticated' and public.is_salon_manager());

create policy "Managers update staff"
  on public.staff for update
  using (auth.role() = 'authenticated' and public.is_salon_manager())
  with check (auth.role() = 'authenticated' and public.is_salon_manager());

-- ---------------------------------------------------------------------------
-- locations — salon business details (single-location MVP)
-- ---------------------------------------------------------------------------
alter table public.locations
  add column if not exists email text,
  add column if not exists booking_email text,
  add column if not exists tagline text,
  add column if not exists logo_url text,
  add column if not exists instagram_url text,
  add column if not exists business_hours jsonb;

comment on column public.locations.business_hours is
  'Weekly hours keyed by ISO day 0–6; null value = closed; { "open": "HH:MM", "close": "HH:MM" }';

update public.locations
set
  email = coalesce(email, 'sayhello@saloncitrineindy.com'),
  booking_email = coalesce(booking_email, 'bookings@saloncitrineindy.com'),
  tagline = coalesce(
    tagline,
    'Hairdressing rooted in inclusion, creativity, and simple beauty for everyone. ♡'
  ),
  instagram_url = coalesce(instagram_url, 'https://www.instagram.com/Saloncitrineindy'),
  address_line1 = coalesce(address_line1, '203 S. Audubon Rd'),
  city = coalesce(city, 'Indianapolis'),
  state = coalesce(state, 'IN'),
  postal_code = coalesce(postal_code, '46219'),
  phone = coalesce(phone, '(317) 476-5375'),
  timezone = coalesce(timezone, 'America/Indiana/Indianapolis'),
  business_hours = coalesce(
    business_hours,
    '{
      "0": null,
      "1": null,
      "2": {"open": "10:00", "close": "20:00"},
      "3": {"open": "10:00", "close": "20:00"},
      "4": {"open": "10:00", "close": "20:00"},
      "5": {"open": "10:00", "close": "17:00"},
      "6": {"open": "10:00", "close": "17:00"}
    }'::jsonb
  )
where slug = 'salon-citrine-indy';
