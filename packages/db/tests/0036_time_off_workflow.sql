begin;
create extension if not exists pgtap;
select plan(6);

insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at)
values
 ('00000000-0000-4000-8000-000000000000','f5000000-0000-4000-8000-000000000001','authenticated','authenticated','to-mgr@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000000','f5000000-0000-4000-8000-000000000002','authenticated','authenticated','to-emp@example.invalid',now(),now());

insert into public.staff (id,slug,name,role,email,supabase_user_id,access_status,is_bookable)
values
 ('f5100000-0000-4000-8000-000000000001','to-mgr','TO Manager','owner','to-mgr@example.invalid','f5000000-0000-4000-8000-000000000001','active',false),
 ('f5100000-0000-4000-8000-000000000002','to-emp','TO Employee','stylist','to-emp@example.invalid','f5000000-0000-4000-8000-000000000002','active',true);

-- Two employee-filed time-off requests (seed to pending) and one announcement.
insert into public.team_events (id,title,event_type,starts_at,all_day,created_by_staff_id,staff_id)
values
 ('f5200000-0000-4000-8000-000000000001','x','time_off',now(),true,'f5100000-0000-4000-8000-000000000002','f5100000-0000-4000-8000-000000000002'),
 ('f5200000-0000-4000-8000-000000000002','x','time_off',now(),true,'f5100000-0000-4000-8000-000000000002','f5100000-0000-4000-8000-000000000002');
insert into public.team_events (id,title,event_type,starts_at,all_day,created_by_staff_id,visibility)
values
 ('f5200000-0000-4000-8000-000000000003','Team notice','announcement',now(),true,'f5100000-0000-4000-8000-000000000001','team');

-- Employee context.
set local role authenticated;
select set_config('request.jwt.claim.sub','f5000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);

select is(
  (select approval_status from public.team_events where id='f5200000-0000-4000-8000-000000000001'),
  'pending', 'employee request seeds to pending'
);
select throws_ok(
  $$update public.team_events set approval_status='approved' where id='f5200000-0000-4000-8000-000000000001'$$,
  '42501', null, 'employee cannot approve their own time off'
);
select lives_ok(
  $$update public.team_events set approval_status='cancelled' where id='f5200000-0000-4000-8000-000000000001'$$,
  'employee can cancel their own pending request'
);

-- Manager context.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','f5000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);

select lives_ok(
  $$update public.team_events set approval_status='approved' where id='f5200000-0000-4000-8000-000000000002'$$,
  'manager can approve a pending request'
);
select is(
  (select decided_by_staff_id::text from public.team_events where id='f5200000-0000-4000-8000-000000000002'),
  'f5100000-0000-4000-8000-000000000001', 'approval stamps the deciding manager'
);
select throws_ok(
  $$update public.team_events set approval_status='approved' where id='f5200000-0000-4000-8000-000000000003'$$,
  '22023', null, 'non time-off cannot carry an approval status'
);

reset role;
select * from finish();
rollback;