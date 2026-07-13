begin;
create extension if not exists pgtap;
select plan(11);

insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at)
values
 ('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000001','authenticated','authenticated','priv-owner@example.invalid',now(),now()),
 ('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000002','authenticated','authenticated','priv-stylist@example.invalid',now(),now()),
 ('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000003','authenticated','authenticated','priv-disabled@example.invalid',now(),now());

insert into public.staff (id,slug,name,role,email,supabase_user_id,access_status,is_bookable)
values
 ('e1000000-0000-4000-8000-000000000001','priv-owner','Priv Owner','owner','priv-owner@example.invalid','e0000000-0000-4000-8000-000000000001','active',true),
 ('e1000000-0000-4000-8000-000000000002','priv-stylist','Priv Stylist','stylist','priv-stylist@example.invalid','e0000000-0000-4000-8000-000000000002','active',true),
 ('e1000000-0000-4000-8000-000000000003','priv-disabled','Priv Disabled','stylist','priv-disabled@example.invalid','e0000000-0000-4000-8000-000000000003','disabled',true);

insert into public.blocked_times (id, staff_id, starts_at, ends_at, reason)
values ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002',
        now(), now() + interval '1 hour', 'Personal medical appointment');

insert into public.team_events (id,title,event_type,starts_at,created_by_staff_id,staff_id,visibility)
values ('e3000000-0000-4000-8000-000000000001','Manager planning','event',now(),
        'e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','managers');

-- Task 14: time-off privacy trigger replaces the reason and neutralizes the title.
insert into public.team_events (id,title,event_type,starts_at,created_by_staff_id,staff_id,description)
values ('e3000000-0000-4000-8000-000000000002','Original','time_off',now(),
        'e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','Surgery recovery');
select ok(
  (select title from public.team_events where id='e3000000-0000-4000-8000-000000000002')
    like '%unavailable',
  'time-off title is neutralized'
);
select is(
  (select description from public.team_events where id='e3000000-0000-4000-8000-000000000002'),
  null, 'time-off public description is cleared'
);
select is(
  (select private_reason from public.team_events where id='e3000000-0000-4000-8000-000000000002'),
  'Surgery recovery', 'time-off reason is moved to the private column'
);

-- Tasks 10/11: anonymous availability exposes intervals but never reasons.
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
select throws_ok(
  $$select reason from public.blocked_times limit 1$$,
  '42501', null, 'anon cannot read blocked_times.reason'
);
select lives_ok(
  $$select id, staff_id, starts_at, ends_at from public.public_blocked_intervals limit 1$$,
  'anon can read the safe availability projection'
);
select is(
  (select count(*)::int from information_schema.columns
    where table_schema='public' and table_name='public_blocked_intervals'
      and column_name='reason'),
  0, 'availability projection has no reason column'
);

-- Task 9: booking carts are server-side only; no anon/authenticated table access.
select throws_ok(
  $$select * from public.booking_carts limit 1$$,
  '42501', null, 'anon has no booking_carts access'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
-- Task 7: a deactivated user is not a linked staff member and reads no team events.
select is(public.is_linked_staff(), false, 'deactivated user is not linked staff');
select is(
  (select count(*)::int from public.team_events),
  0, 'deactivated user reads no team events'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
-- Task 13: an active non-manager cannot see a managers-only event.
select is(
  (select count(*)::int from public.team_events
    where id='e3000000-0000-4000-8000-000000000001'),
  0, 'non-manager cannot read a managers-only event'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is(
  (select count(*)::int from public.team_events
    where id='e3000000-0000-4000-8000-000000000001'),
  1, 'a manager can read a managers-only event'
);

select * from finish();
rollback;
