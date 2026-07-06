-- Realistic demo clients for mobile UX / team app previews.
-- Replaces common placeholder records (test test, repeated 555 numbers).

-- Normalize obvious placeholder rows in place when present.
update public.clients
set
  first_name = 'Morgan',
  last_name = 'Reyes',
  phone = '(317) 555-0142',
  email = 'morgan.reyes@example.com',
  tags = array['Balayage', 'VIP'],
  visit_count = 6,
  last_visit_at = now() - interval '18 days',
  lifetime_value_cents = 84000,
  booking_preferences = 'Goes by Mo',
  referral_sources = array['Instagram']
where lower(trim(first_name)) = 'test'
  and lower(trim(last_name)) = 'test';

update public.clients
set
  first_name = 'Jordan',
  last_name = 'Ellis',
  phone = '(317) 555-0198',
  email = 'jordan.ellis@example.com',
  tags = array['Blonding'],
  visit_count = 3,
  last_visit_at = now() - interval '42 days',
  lifetime_value_cents = 42000,
  booking_preferences = 'Prefers afternoon appointments',
  referral_sources = array['Friend or family referral']
where phone ~ '^5555555555?$'
   or replace(replace(replace(phone, '-', ''), '(', ''), ')', '') ~ '^5555555555?$';

-- Idempotent demo roster (safe to re-run).
insert into public.clients (
  id,
  first_name,
  last_name,
  phone,
  email,
  tags,
  visit_count,
  last_visit_at,
  lifetime_value_cents,
  booking_preferences,
  referral_sources,
  sms_opt_in,
  email_opt_in
)
values
  (
    'c1000001-0001-4000-8000-000000000001',
    'Emma',
    'Whitfield',
    '(317) 555-0103',
    'emma.whitfield@example.com',
    array['Color correction', 'VIP'],
    8,
    now() - interval '12 days',
    126000,
    'Goes by Em',
    array['Google / search'],
    true,
    true
  ),
  (
    'c1000001-0001-4000-8000-000000000002',
    'Avery',
    'Nguyen',
    '(317) 555-0117',
    'avery.nguyen@example.com',
    array['Facials'],
    4,
    now() - interval '28 days',
    52000,
    null,
    array['Instagram'],
    true,
    true
  ),
  (
    'c1000001-0001-4000-8000-000000000003',
    'Sofia',
    'Martinez',
    '(317) 555-0131',
    'sofia.martinez@example.com',
    array['Extensions'],
    2,
    now() - interval '9 days',
    31000,
    'Prefers Shelby for vivid color',
    array['Walk-by / drove past'],
    false,
    true
  ),
  (
    'c1000001-0001-4000-8000-000000000004',
    'Taylor',
    'Brooks',
    '(317) 555-0155',
    'taylor.brooks@example.com',
    array['New client'],
    0,
    null,
    0,
    null,
    array['Other'],
    true,
    false
  )
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  phone = excluded.phone,
  email = excluded.email,
  tags = excluded.tags,
  visit_count = excluded.visit_count,
  last_visit_at = excluded.last_visit_at,
  lifetime_value_cents = excluded.lifetime_value_cents,
  booking_preferences = excluded.booking_preferences,
  referral_sources = excluded.referral_sources;
