begin;
create extension if not exists pgtap;
select plan(3);

insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at)
values
 ('00000000-0000-4000-8000-000000000000','b9000000-0000-4000-8000-000000000001','authenticated','authenticated','grant-emp@example.invalid',now(),now());

insert into public.staff (id,slug,name,role,email,supabase_user_id,access_status,is_bookable)
values
 ('b9100000-0000-4000-8000-000000000001','grant-emp','Grant Emp','stylist','grant-emp@example.invalid','b9000000-0000-4000-8000-000000000001','active',true);

set local role authenticated;
select set_config('request.jwt.claim.sub','b9000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);

select lives_ok(
  $$select id, role from public.staff where id='b9100000-0000-4000-8000-000000000001'$$,
  'authenticated linked staff can select staff rows (explicit API grants)'
);
select throws_ok(
  $$select private_reason from public.team_events limit 1$$,
  '42501', null, 'authenticated cannot select private_reason column'
);
select has_table('public', 'staff', 'staff table still present after grants migration');

reset role;
select * from finish();
rollback;
