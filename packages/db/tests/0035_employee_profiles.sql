begin;
create extension if not exists pgtap;
select plan(8);

insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at)
values
 ('00000000-0000-0000-0000-000000000000','d0000000-0000-4000-8000-000000000001','authenticated','authenticated','prof-owner@example.invalid',now(),now()),
 ('00000000-0000-0000-0000-000000000000','d0000000-0000-4000-8000-000000000002','authenticated','authenticated','prof-a@example.invalid',now(),now()),
 ('00000000-0000-0000-0000-000000000000','d0000000-0000-4000-8000-000000000003','authenticated','authenticated','prof-b@example.invalid',now(),now());

insert into public.staff (id,slug,name,role,email,supabase_user_id,access_status,is_bookable,bio,start_date)
values
 ('d1000000-0000-4000-8000-000000000001','prof-owner','Prof Owner','owner','prof-owner@example.invalid','d0000000-0000-4000-8000-000000000001','active',false,null,null),
 ('d1000000-0000-4000-8000-000000000002','prof-a','Prof A','stylist','prof-a@example.invalid','d0000000-0000-4000-8000-000000000002','active',true,'Loves balayage','2021-03-01'),
 ('d1000000-0000-4000-8000-000000000003','prof-b','Prof B','stylist','prof-b@example.invalid','d0000000-0000-4000-8000-000000000003','active',true,null,null);

insert into public.staff_private_details (staff_id, emergency_contact_name, emergency_contact_phone)
values ('d1000000-0000-4000-8000-000000000002','Jamie Doe','+13175551234');

-- A non-manager employee must never read another employee's emergency contact.
set local role authenticated;
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is(
  (select count(*)::int from public.staff_private_details
    where staff_id='d1000000-0000-4000-8000-000000000002'),
  0, 'a coworker cannot read another employee private details'
);
-- Team-visible bio is still readable across the team.
select is(
  (select bio from public.staff where id='d1000000-0000-4000-8000-000000000002'),
  'Loves balayage', 'team-visible bio is readable by coworkers'
);

-- The employee themselves can read their own emergency contact.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is(
  (select count(*)::int from public.staff_private_details
    where staff_id='d1000000-0000-4000-8000-000000000002'),
  1, 'an employee can read their own private details'
);

-- A manager can read any employee emergency contact.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is(
  (select count(*)::int from public.staff_private_details
    where staff_id='d1000000-0000-4000-8000-000000000002'),
  1, 'a manager can read any employee private details'
);

-- Managers may set the new team-visible start_date via the superseded RPC.
select lives_ok(
  $mgr$select public.manager_update_staff(
    'd1000000-0000-4000-8000-000000000002',
    '{"start_date":"2020-01-15"}'::jsonb,
    'test'
  )$mgr$,
  'manager can set start_date'
);
select is(
  (select start_date::text from public.staff where id='d1000000-0000-4000-8000-000000000002'),
  '2020-01-15', 'start_date is persisted by manager update'
);
select throws_ok(
  $mgr$select public.manager_update_staff(
    'd1000000-0000-4000-8000-000000000002',
    '{"ssn":"x"}'::jsonb,
    'test'
  )$mgr$,
  '22023', null, 'manager update rejects unknown fields'
);

-- Anonymous callers have no access at all.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
select throws_ok(
  $$select * from public.staff_private_details limit 1$$,
  '42501', null, 'anon cannot read employee private details'
);

reset role;
select * from finish();
rollback;